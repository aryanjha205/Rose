import unittest
import json
from backend.app import create_app
from backend.database import db
from backend.models.user import User
from backend.models.contact import Contact
from backend.models.call_log import CallLog
from backend.sockets import socketio

class WebCallTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(config_override={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"
        })
        self.client = self.app.test_client()

        with self.app.app_context():
            db.drop_all()
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "healthy")

    def test_ice_servers_endpoint(self):
        res = self.client.get("/api/config/ice")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("iceServers", data)
        self.assertTrue(len(data["iceServers"]) > 0)

    def test_auth_registration_and_login(self):
        # Register user Alice
        res = self.client.post("/api/auth/register", json={
            "username": "alice",
            "email": "alice@test.com",
            "password": "password123",
            "display_name": "Alice Walker"
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIn("token", data)
        self.assertEqual(data["user"]["username"], "alice")
        token_alice = data["token"]

        # Duplicate username should fail
        res_dup = self.client.post("/api/auth/register", json={
            "username": "alice",
            "email": "alice2@test.com",
            "password": "password123"
        })
        self.assertEqual(res_dup.status_code, 409)

        # Register user Bob
        res_bob = self.client.post("/api/auth/register", json={
            "username": "bob",
            "email": "bob@test.com",
            "password": "password123",
            "display_name": "Bob Miller"
        })
        self.assertEqual(res_bob.status_code, 201)
        token_bob = res_bob.get_json()["token"]

        # Login Alice
        res_login = self.client.post("/api/auth/login", json={
            "username": "alice",
            "password": "password123"
        })
        self.assertEqual(res_login.status_code, 200)
        self.assertTrue(res_login.get_json()["success"])

        # /api/auth/me
        res_me = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_alice}"})
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.get_json()["user"]["username"], "alice")

        # Search users
        res_search = self.client.get("/api/users/search?q=bob", headers={"Authorization": f"Bearer {token_alice}"})
        self.assertEqual(res_search.status_code, 200)
        search_data = res_search.get_json()
        self.assertEqual(search_data["count"], 1)
        self.assertEqual(search_data["users"][0]["username"], "bob")

        # Add Bob to Alice's contacts
        bob_id = res_bob.get_json()["user"]["id"]
        res_add_contact = self.client.post("/api/contacts", json={
            "contact_user_id": bob_id,
            "nickname": "Bobby"
        }, headers={"Authorization": f"Bearer {token_alice}"})
        self.assertEqual(res_add_contact.status_code, 201)

        # Cannot add oneself
        alice_id = data["user"]["id"]
        res_add_self = self.client.post("/api/contacts", json={
            "contact_user_id": alice_id
        }, headers={"Authorization": f"Bearer {token_alice}"})
        self.assertEqual(res_add_self.status_code, 400)

        # Get contacts
        res_contacts = self.client.get("/api/contacts", headers={"Authorization": f"Bearer {token_alice}"})
        self.assertEqual(res_contacts.status_code, 200)
        self.assertEqual(len(res_contacts.get_json()["contacts"]), 1)

        # Update profile
        res_profile = self.client.put("/api/users/profile", json={
            "display_name": "Alice in Wonderland",
            "bio": "Online and ready to video call!"
        }, headers={"Authorization": f"Bearer {token_alice}"})
        self.assertEqual(res_profile.status_code, 200)
        self.assertEqual(res_profile.get_json()["user"]["display_name"], "Alice in Wonderland")

        # Update password
        res_pass = self.client.put("/api/users/password", json={
            "current_password": "password123",
            "new_password": "newpassword123"
        }, headers={"Authorization": f"Bearer {token_alice}"})
        self.assertEqual(res_pass.status_code, 200)

        # Log a completed call
        with self.app.app_context():
            call = CallLog(
                caller_id=alice_id,
                receiver_id=bob_id,
                call_type="video",
                status="completed",
                duration_seconds=125
            )
            db.session.add(call)
            db.session.commit()

        # Check recent calls
        res_recent = self.client.get("/api/calls/recent", headers={"Authorization": f"Bearer {token_alice}"})
        self.assertEqual(res_recent.status_code, 200)
        recent_data = res_recent.get_json()
        self.assertEqual(recent_data["count"], 1)
        self.assertEqual(recent_data["calls"][0]["call_type"], "video")
        self.assertEqual(recent_data["calls"][0]["duration_seconds"], 125)

        # Call stats endpoint
        res_stats = self.client.get("/api/calls/stats", headers={"Authorization": f"Bearer {token_alice}"})
        self.assertEqual(res_stats.status_code, 200)
        stats = res_stats.get_json()["stats"]
        self.assertEqual(stats["total_calls"], 1)
        self.assertEqual(stats["video_calls"], 1)
        self.assertEqual(stats["total_duration_minutes"], 2.1)

if __name__ == "__main__":
    unittest.main()
