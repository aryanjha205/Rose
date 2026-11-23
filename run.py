import os
from backend.app import create_app
from backend.sockets import socketio

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"==================================================")
    print(f"  Rosé Real-Time Calling Server Starting          ")
    print(f"  Address: http://127.0.0.1:{port}               ")
    print(f"==================================================")
    socketio.run(app, host="0.0.0.0", port=port, debug=debug, allow_unsafe_werkzeug=True)
