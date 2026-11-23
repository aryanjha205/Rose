/**
 * WebCall WebRTC Manager
 * Manages RTCPeerConnection, media streams, audio/video tracks, camera switching,
 * call states, duration timers, and signaling handshakes.
 */
class WebRTCManager {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCall = null;
    this.callTimerInterval = null;
    this.callDurationSeconds = 0;
    this.iceCandidateQueue = [];
    this.currentFacingMode = "user"; // 'user' (front) or 'environment' (back)
    this.isMuted = false;
    this.isCameraOff = false;
    this.isSpeakerOn = true;
  }

  // =========================================================================
  // Media Stream Setup & Controls
  // =========================================================================

  async getMedia(callType, facingMode = "user") {
    const isVideo = callType === "video";
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: isVideo ? {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } : false
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentFacingMode = facingMode;

      // Attach to local video preview if video call
      const localVideoEl = document.getElementById("local-video");
      if (localVideoEl && isVideo) {
        localVideoEl.srcObject = this.localStream;
        localVideoEl.play().catch(e => console.warn("Local play error:", e));
      }

      return this.localStream;
    } catch (err) {
      console.error("getUserMedia error:", err);
      // Fallback: If video failed, attempt audio only
      if (isVideo) {
        window.ui.showToast("Camera access failed; falling back to voice only.", "info");
        return this.getMedia("voice");
      }
      throw err;
    }
  }

  toggleMicrophone() {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.isMuted = !audioTrack.enabled;
      window.ui.updateMicButtonState(this.isMuted);
      window.ui.showToast(this.isMuted ? "Microphone muted" : "Microphone unmuted", "info");
      return this.isMuted;
    }
    return false;
  }

  toggleCamera() {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.isCameraOff = !videoTrack.enabled;
      window.ui.updateCameraButtonState(this.isCameraOff);
      window.ui.showToast(this.isCameraOff ? "Camera turned off" : "Camera turned on", "info");
      return this.isCameraOff;
    }
    return false;
  }

  async switchCamera() {
    if (!this.localStream || this.currentCall?.callType !== "video") return;

    const newFacingMode = this.currentFacingMode === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacingMode } }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === "video");
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      // Stop old video track
      const oldTrack = this.localStream.getVideoTracks()[0];
      if (oldTrack) oldTrack.stop();
      this.localStream.removeTrack(oldTrack);
      this.localStream.addTrack(newVideoTrack);

      const localVideoEl = document.getElementById("local-video");
      if (localVideoEl) {
        localVideoEl.srcObject = this.localStream;
      }
      this.currentFacingMode = newFacingMode;
      window.ui.showToast(`Switched to ${newFacingMode === 'user' ? 'front' : 'rear'} camera`, "info");
    } catch (err) {
      console.warn("Could not switch camera:", err);
      window.ui.showToast("Camera switching not supported on this device.", "info");
    }
  }

  // =========================================================================
  // WebRTC PeerConnection Creation
  // =========================================================================

  async createPeerConnection() {
    const iceServers = await window.api.getIceServers();
    this.peerConnection = new RTCPeerConnection({ iceServers });

    // Send local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      console.log("Remote track received:", event.track.kind);
      this.remoteStream = event.streams[0] || new MediaStream([event.track]);

      if (this.currentCall?.callType === "video") {
        const remoteVideo = document.getElementById("remote-video");
        if (remoteVideo) {
          remoteVideo.srcObject = this.remoteStream;
          remoteVideo.play().catch(e => console.warn("Remote play err:", e));
        }
      } else {
        // Voice call
        const remoteAudio = document.getElementById("remote-audio");
        if (remoteAudio) {
          remoteAudio.srcObject = this.remoteStream;
          remoteAudio.play().catch(e => console.warn("Audio play err:", e));
        }
        // Connect waveform visualizer to remote audio
        const canvas = document.getElementById("voice-waveform-canvas");
        if (canvas) {
          window.soundManager.startWaveformVisualizer(this.remoteStream, canvas);
        }
      }
    };

    // ICE Candidate generation
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.currentCall) {
        window.socketClient.sendIceCandidate(this.currentCall.callId, event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log("WebRTC connection state:", this.peerConnection.connectionState);
      if (this.peerConnection.connectionState === "disconnected" ||
          this.peerConnection.connectionState === "failed") {
        window.ui.showToast("Call connection lost", "error");
        this.cleanupCall();
      }
    };
  }

  // =========================================================================
  // Call Flow Handlers
  // =========================================================================

  /**
   * Start calling another user
   */
  async startCall(toUser, callType = "voice") {
    if (this.currentCall) {
      window.ui.showToast("You are already in a call", "error");
      return;
    }

    try {
      await this.getMedia(callType);
    } catch (err) {
      window.ui.showToast("Microphone / Camera permission is required to place calls.", "error");
      return;
    }

    this.currentCall = {
      peer: toUser,
      callType,
      isCaller: true,
      status: "dialing"
    };

    window.socketClient.callUser(toUser.id, callType);
  }

  handleOutgoingCallStarted(data) {
    if (!this.currentCall) return;
    this.currentCall.callId = data.callId;
    this.currentCall.status = "ringing";

    window.soundManager.playOutgoingDialtone();
    window.ui.showOutgoingCallScreen(data.receiver, data.callType);
  }

  handleIncomingCall(data) {
    if (this.currentCall) {
      // Busy on another call
      window.socketClient.rejectCall(data.callId);
      return;
    }

    this.currentCall = {
      callId: data.callId,
      peer: data.caller,
      callType: data.callType,
      isCaller: false,
      status: "ringing"
    };

    window.soundManager.playIncomingRingtone();
    window.ui.showIncomingCallScreen(data.caller, data.callType);

    // If call was opened from a background ringing notification (auto-answer)
    if (window.autoAnswerPendingCallId === data.callId) {
      window.autoAnswerPendingCallId = null;
      setTimeout(() => {
        this.acceptIncomingCall();
      }, 400);
    }
  }

  async acceptIncomingCall() {
    if (!this.currentCall) return;
    window.soundManager.stopIncomingRingtone();

    try {
      await this.getMedia(this.currentCall.callType);
      await this.createPeerConnection();

      window.socketClient.acceptCall(this.currentCall.callId);
    } catch (err) {
      console.error("Accept call error:", err);
      window.ui.showToast("Failed to access audio/camera device", "error");
      this.rejectIncomingCall();
    }
  }

  rejectIncomingCall() {
    if (!this.currentCall) return;
    window.soundManager.stopIncomingRingtone();
    window.socketClient.rejectCall(this.currentCall.callId);
    this.cleanupCall();
  }

  cancelOutgoingCall() {
    if (!this.currentCall) return;
    window.soundManager.stopOutgoingDialtone();
    window.socketClient.cancelCall(this.currentCall.callId);
    this.cleanupCall();
  }

  async handleCallAcceptedByPeer(data) {
    // Caller receives acceptance from peer
    window.soundManager.stopOutgoingDialtone();
    window.soundManager.playCallConnectedTone();

    this.currentCall.status = "connected";
    window.ui.hideOutgoingCallScreen();
    window.ui.showActiveCallScreen(this.currentCall.peer, this.currentCall.callType);
    this.startCallDurationTimer();

    // Create SDP Offer
    await this.createPeerConnection();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    window.socketClient.sendSdpOffer(this.currentCall.callId, offer);
  }

  handleCallAcceptedAck(data) {
    // Receiver receives confirmation
    window.soundManager.stopIncomingRingtone();
    window.soundManager.playCallConnectedTone();

    this.currentCall.status = "connected";
    window.ui.hideIncomingCallScreen();
    window.ui.showActiveCallScreen(this.currentCall.peer, this.currentCall.callType);
    this.startCallDurationTimer();
  }

  async handleSdpOffer(data) {
    if (!this.peerConnection) {
      await this.createPeerConnection();
    }
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));

    // Process queued candidates
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      await this.peerConnection.addIceCandidate(candidate).catch(e => console.warn(e));
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    window.socketClient.sendSdpAnswer(this.currentCall.callId, answer);
  }

  async handleSdpAnswer(data) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      while (this.iceCandidateQueue.length > 0) {
        const candidate = this.iceCandidateQueue.shift();
        await this.peerConnection.addIceCandidate(candidate).catch(e => console.warn(e));
      }
    }
  }

  async handleIceCandidate(data) {
    const candidate = new RTCIceCandidate(data.candidate);
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      await this.peerConnection.addIceCandidate(candidate).catch(e => console.warn(e));
    } else {
      this.iceCandidateQueue.push(candidate);
    }
  }

  handleCallRejected(data) {
    window.soundManager.stopOutgoingDialtone();
    window.soundManager.playCallEndTone();
    window.ui.showToast(data.message || "Call was declined", "info");
    this.cleanupCall();
  }

  handleCallCancelled(data) {
    window.soundManager.stopIncomingRingtone();
    window.soundManager.playCallEndTone();
    window.ui.showToast(data.message || "Call was cancelled by caller", "info");
    this.cleanupCall();
  }

  handleCallTimeout(data) {
    window.soundManager.stopIncomingRingtone();
    window.soundManager.stopOutgoingDialtone();
    window.soundManager.playCallEndTone();
    window.ui.showToast("Call timed out. No response.", "info");
    this.cleanupCall();
    if (window.ui.currentView === "history" || window.ui.currentView === "missed") {
      window.ui.loadCalls();
    }
  }

  handleCallEnded(data) {
    window.soundManager.playCallEndTone();
    window.ui.showToast(`Call ended (${this.formatDuration(data.duration || this.callDurationSeconds)})`, "info");
    this.cleanupCall();
    if (window.ui.currentView === "history" || window.ui.currentView === "missed") {
      window.ui.loadCalls();
    }
  }

  handleUserOffline(data) {
    window.soundManager.stopOutgoingDialtone();
    window.soundManager.playCallEndTone();
    window.ui.showToast(data.message || "User is currently offline.", "info");
    this.cleanupCall();
  }

  handleUserBusy(data) {
    window.soundManager.stopOutgoingDialtone();
    window.soundManager.playCallEndTone();
    window.ui.showToast(data.message || "User is busy on another call.", "info");
    this.cleanupCall();
  }

  endCurrentCall() {
    if (!this.currentCall) return;
    const duration = this.callDurationSeconds;
    window.socketClient.endCall(this.currentCall.callId, duration);
    this.cleanupCall();
  }

  // =========================================================================
  // Timers & Cleanup
  // =========================================================================

  startCallDurationTimer() {
    this.callDurationSeconds = 0;
    if (this.callTimerInterval) clearInterval(this.callTimerInterval);

    this.callTimerInterval = setInterval(() => {
      this.callDurationSeconds++;
      const formatted = this.formatDuration(this.callDurationSeconds);
      window.ui.updateCallDuration(formatted);
    }, 1000);
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  cleanupCall() {
    window.soundManager.stopIncomingRingtone();
    window.soundManager.stopOutgoingDialtone();
    window.soundManager.stopWaveformVisualizer();

    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
    }
    this.callDurationSeconds = 0;

    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Stop remote video/audio playback
    const remoteVideo = document.getElementById("remote-video");
    if (remoteVideo) remoteVideo.srcObject = null;
    const remoteAudio = document.getElementById("remote-audio");
    if (remoteAudio) remoteAudio.srcObject = null;
    const localVideo = document.getElementById("local-video");
    if (localVideo) localVideo.srcObject = null;

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.iceCandidateQueue = [];
    this.isMuted = false;
    this.isCameraOff = false;
    this.currentCall = null;

    window.ui.hideAllCallScreens();
  }
}

window.webrtcManager = new WebRTCManager();
