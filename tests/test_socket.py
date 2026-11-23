import unittest
from backend.app import create_app
from backend.database import db
from backend.models.user import User
from backend.models.call_log import CallLog
from backend.sockets import socketio
from backend.services.auth_service import generate_token

class SocketSignalingTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(config_override={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"
        })

        with self.app.app_context():
            db.drop_all()
            db.create_all()

            # Create test users
            self.user1 = User(
                username="alice",
                email="alice@test.com",
                display_name="Alice"
            )
            self.user1.set_password("pass123")

            self.user2 = User(
                username="bob",
                email="bob@test.com",
                display_name="Bob"
            )
            self.user2.set_password("pass123")

            db.session.add_all([self.user1, self.user2])
            db.session.commit()

            self.token1 = generate_token(self.user1)
            self.token2 = generate_token(self.user2)
            self.u1_id = self.user1.id
            self.u2_id = self.user2.id

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_socket_auth_and_call_cycle(self):
        # Client 1 connects and authenticates
        client1 = socketio.test_client(self.app)
        client1.emit("authenticate", {"token": self.token1})
        received1 = client1.get_received()
        auth_events = [e for e in received1 if e["name"] == "authenticated"]
        self.assertTrue(len(auth_events) > 0)
        self.assertEqual(auth_events[0]["args"][0]["user"]["username"], "alice")

        # Client 2 connects and authenticates
        client2 = socketio.test_client(self.app)
        client2.emit("authenticate", {"token": self.token2})
        received2 = client2.get_received()
        self.assertTrue(any(e["name"] == "authenticated" for e in received2))

        # Client 1 calls Client 2 (voice call)
        client1.emit("call-user", {"toUserId": self.u2_id, "callType": "voice"})
        c1_events = client1.get_received()
        c2_events = client2.get_received()

        outgoing_started = [e for e in c1_events if e["name"] == "outgoing-call-started"]
        self.assertTrue(len(outgoing_started) > 0)
        call_id = outgoing_started[0]["args"][0]["callId"]

        incoming_call = [e for e in c2_events if e["name"] == "incoming-call"]
        self.assertTrue(len(incoming_call) > 0)
        self.assertEqual(incoming_call[0]["args"][0]["caller"]["username"], "alice")

        # Client 2 accepts call
        client2.emit("accept-call", {"callId": call_id})
        c1_accepted = [e for e in client1.get_received() if e["name"] == "call-accepted"]
        self.assertTrue(len(c1_accepted) > 0)

        # Exchange SDP offer from Client 1
        client1.emit("sdp-offer", {"callId": call_id, "sdp": {"type": "offer", "sdp": "v=0..."}})
        c2_offer = [e for e in client2.get_received() if e["name"] == "sdp-offer"]
        self.assertTrue(len(c2_offer) > 0)

        # Exchange SDP answer from Client 2
        client2.emit("sdp-answer", {"callId": call_id, "sdp": {"type": "answer", "sdp": "v=0..."}})
        c1_answer = [e for e in client1.get_received() if e["name"] == "sdp-answer"]
        self.assertTrue(len(c1_answer) > 0)

        # End call
        client1.emit("end-call", {"callId": call_id, "duration": 45})
        c2_ended = [e for e in client2.get_received() if e["name"] == "call-ended"]
        self.assertTrue(len(c2_ended) > 0)
        self.assertEqual(c2_ended[0]["args"][0]["duration"], 45)

        # Verify call log saved in database
        with self.app.app_context():
            log = CallLog.query.filter_by(status="completed").first()
            self.assertIsNotNone(log)
            self.assertEqual(log.duration_seconds, 45)
            self.assertEqual(log.call_type, "voice")

        client1.disconnect()
        client2.disconnect()

if __name__ == "__main__":
    unittest.main()
