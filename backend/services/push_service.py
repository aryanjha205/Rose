import json
import threading
from flask import current_app
from pywebpush import webpush, WebPushException
from backend.database import db
from backend.models.push_subscription import PushSubscription

def send_push_notification_worker(app, user_id, payload_dict):
    with app.app_context():
        vapid_private_key = app.config.get("VAPID_PRIVATE_KEY_PEM")
        vapid_claims = {
            "sub": app.config.get("VAPID_CLAIMS_EMAIL", "mailto:support@rose-juih.onrender.com")
        }

        if not vapid_private_key:
            return

        subs = PushSubscription.query.filter_by(user_id=user_id).all()
        if not subs:
            return

        payload_json = json.dumps(payload_dict)

        for sub in subs:
            try:
                webpush(
                    subscription_info=sub.to_subscription_info(),
                    data=payload_json,
                    vapid_private_key=vapid_private_key,
                    vapid_claims=vapid_claims,
                    ttl=45
                )
            except WebPushException as ex:
                # If subscription has expired or unsubscribed, remove from DB
                if ex.response and ex.response.status_code in (404, 410):
                    try:
                        db.session.delete(sub)
                        db.session.commit()
                    except Exception:
                        db.session.rollback()
            except Exception as e:
                app.logger.warning(f"Push notification error for user {user_id}: {e}")

def send_call_push_alert(app, target_user_id, caller, call_type, call_id):
    """
    Sends background call push notification with ring vibration even when app is closed.
    """
    payload = {
        "type": "incoming-call",
        "callId": call_id,
        "callType": call_type,
        "caller": caller
    }
    t = threading.Thread(
        target=send_push_notification_worker,
        args=[app._get_current_object() if hasattr(app, '_get_current_object') else app, target_user_id, payload],
        daemon=True
    )
    t.start()

def send_call_cancelled_alert(app, target_user_id, call_id):
    """
    Dismisses incoming call notification when caller hangs up or timeout expires.
    """
    payload = {
        "type": "call-cancelled",
        "callId": call_id
    }
    t = threading.Thread(
        target=send_push_notification_worker,
        args=[app._get_current_object() if hasattr(app, '_get_current_object') else app, target_user_id, payload],
        daemon=True
    )
    t.start()
