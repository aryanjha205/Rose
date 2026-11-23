/**
 * WebCall Global Configuration
 */
const CONFIG = {
  // Automatically detects current host (ideal for unified Render service or local dev),
  // or can point to backend Render Web Service URL when frontend is hosted separately on Render Static Site.
  BACKEND_URL: window.WEBCALL_BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `${window.location.protocol}//${window.location.hostname}:${window.location.port || '5000'}`
      : window.location.origin
  ),

  // Public STUN/TURN ICE Servers
  ICE_SERVERS: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" }
  ],

  // Call timeouts
  CALL_TIMEOUT_MS: 30000,
  SEARCH_DEBOUNCE_MS: 300
};

// Export to window
window.CONFIG = CONFIG;
