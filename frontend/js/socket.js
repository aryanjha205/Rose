/**
 * WebCall Socket.IO Client & Signaling Dispatcher
 */
class SocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    const token = window.api.getToken();
    if (!token) return;

    if (this.socket && this.socket.connected) {
      return;
    }

    const socketUrl = window.CONFIG.BACKEND_URL;
    console.log("Connecting Socket.IO to:", socketUrl);

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.bindEvents();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  bindEvents() {
    this.socket.on("connect", () => {
      console.log("Socket connected, id:", this.socket.id);
      this.isConnected = true;
      const token = window.api.getToken();
      if (token) {
        this.socket.emit("authenticate", { token });
      }
    });

    this.socket.on("authenticated", (data) => {
      console.log("Socket authenticated successfully:", data.user?.username);
      window.dispatchEvent(new CustomEvent("webcall:socket-ready", { detail: data }));
    });

    this.socket.on("auth-error", (data) => {
      console.warn("Socket auth error:", data.message);
    });

    // Real-Time Online Presence
    this.socket.on("user-status", (data) => {
      window.dispatchEvent(new CustomEvent("webcall:user-status", { detail: data }));
    });

    // Real-Time Contact Request Notification
    this.socket.on("contact-request-received", (data) => {
      console.log("Contact request received:", data);
      const sender = data.request?.sender;
      window.ui.showToast(`🌸 @${sender?.username || 'A user'} sent you a contact request!`, "info");
      window.ui.loadContacts();
      if (window.ui.currentView === "search") {
        const query = document.getElementById("search-users-input")?.value || "";
        window.ui.loadSearch(query);
      }
    });

    this.socket.on("contact-request-accepted", (data) => {
      console.log("Contact request accepted:", data);
      const user = data.user;
      window.ui.showToast(`✨ @${user?.username || 'A user'} approved your contact request! You can now call each other.`, "success");
      window.ui.loadContacts();
      if (window.ui.currentView === "search") {
        const query = document.getElementById("search-users-input")?.value || "";
        window.ui.loadSearch(query);
      }
    });

    // Incoming Call from peer
    this.socket.on("incoming-call", (data) => {
      console.log("Incoming call:", data);
      window.webrtcManager.handleIncomingCall(data);
    });

    // Outgoing call dialing feedback
    this.socket.on("outgoing-call-started", (data) => {
      console.log("Outgoing call started:", data);
      window.webrtcManager.handleOutgoingCallStarted(data);
    });

    // Call Accepted by peer
    this.socket.on("call-accepted", (data) => {
      console.log("Call accepted by peer:", data);
      window.webrtcManager.handleCallAcceptedByPeer(data);
    });

    this.socket.on("call-accepted-ack", (data) => {
      console.log("Call accepted ack:", data);
      window.webrtcManager.handleCallAcceptedAck(data);
    });

    // Call Rejected
    this.socket.on("call-rejected", (data) => {
      console.log("Call rejected:", data);
      window.webrtcManager.handleCallRejected(data);
    });

    // Call Cancelled
    this.socket.on("call-cancelled", (data) => {
      console.log("Call cancelled:", data);
      window.webrtcManager.handleCallCancelled(data);
    });

    // 30-Second Call Timeout
    this.socket.on("call-timeout", (data) => {
      console.log("Call timed out:", data);
      window.webrtcManager.handleCallTimeout(data);
    });

    // Call Ended
    this.socket.on("call-ended", (data) => {
      console.log("Call ended:", data);
      window.webrtcManager.handleCallEnded(data);
    });

    // Target User Offline
    this.socket.on("user-offline", (data) => {
      console.log("User offline:", data);
      window.webrtcManager.handleUserOffline(data);
    });

    // Target User Busy
    this.socket.on("user-busy", (data) => {
      console.log("User busy:", data);
      window.webrtcManager.handleUserBusy(data);
    });

    // WebRTC Signaling messages
    this.socket.on("sdp-offer", (data) => {
      window.webrtcManager.handleSdpOffer(data);
    });

    this.socket.on("sdp-answer", (data) => {
      window.webrtcManager.handleSdpAnswer(data);
    });

    this.socket.on("ice-candidate", (data) => {
      window.webrtcManager.handleIceCandidate(data);
    });

    this.socket.on("call-error", (data) => {
      window.ui.showToast(data.message || "Call error occurred", "error");
      window.webrtcManager.cleanupCall();
    });
  }

  // Emission helper methods
  callUser(toUserId, callType = "voice") {
    if (!this.socket) return;
    this.socket.emit("call-user", { toUserId, callType });
  }

  acceptCall(callId) {
    if (!this.socket) return;
    this.socket.emit("accept-call", { callId });
  }

  rejectCall(callId) {
    if (!this.socket) return;
    this.socket.emit("reject-call", { callId });
  }

  cancelCall(callId) {
    if (!this.socket) return;
    this.socket.emit("cancel-call", { callId });
  }

  endCall(callId, duration = 0) {
    if (!this.socket) return;
    this.socket.emit("end-call", { callId, duration });
  }

  sendSdpOffer(callId, sdp) {
    if (!this.socket) return;
    this.socket.emit("sdp-offer", { callId, sdp });
  }

  sendSdpAnswer(callId, sdp) {
    if (!this.socket) return;
    this.socket.emit("sdp-answer", { callId, sdp });
  }

  sendIceCandidate(callId, candidate) {
    if (!this.socket) return;
    this.socket.emit("ice-candidate", { callId, candidate });
  }
}

window.socketClient = new SocketClient();
