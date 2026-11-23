/**
 * WebCall Application Bootstrap & Event Controller
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Rosé Initializing...");

  // Capture autoAnswer parameter if opened via background push notification
  const urlParams = new URLSearchParams(window.location.search);
  const autoAnswerId = urlParams.get("autoAnswer");
  if (autoAnswerId) {
    window.autoAnswerPendingCallId = autoAnswerId;
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  // Initialize UI & Auth
  setupEventListeners();

  const isAuthed = await window.auth.checkAuth();
  if (isAuthed) {
    onUserAuthenticated(window.auth.user);
  } else {
    showAuthScreen("login");
  }
});

function onUserAuthenticated(user) {
  document.getElementById("auth-wrapper").style.display = "none";
  document.getElementById("app-layout").style.display = "flex";

  window.ui.updateSidebarUserInfo(user);
  window.socketClient.connect();

  // Initialize background push notifications for call ringing when app is closed
  initPushNotifications();

  // Route to view based on URL hash or default to dashboard
  const hash = window.location.hash.replace("#", "") || "dashboard";
  const validViews = ["dashboard", "contacts", "search", "history", "missed", "profile", "settings"];
  const initialView = validViews.includes(hash) ? hash : "dashboard";
  window.ui.switchView(initialView);
}

function showAuthScreen(mode = "login") {
  document.getElementById("auth-wrapper").style.display = "flex";
  document.getElementById("app-layout").style.display = "none";

  if (mode === "login") {
    document.getElementById("login-box").style.display = "block";
    document.getElementById("signup-box").style.display = "none";
  } else {
    document.getElementById("login-box").style.display = "none";
    document.getElementById("signup-box").style.display = "block";
  }
}

function setupEventListeners() {
  // Hash Change
  window.addEventListener("hashchange", () => {
    if (!window.auth.isAuthenticated) return;
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      window.ui.switchView(hash);
    }
  });

  // Unauthorized event (token expired)
  window.addEventListener("webcall:unauthorized", () => {
    window.ui.showToast("Your session has expired. Please log in again.", "info");
    showAuthScreen("login");
  });

  // User online/offline real-time status
  window.addEventListener("webcall:user-status", (event) => {
    const { userId, isOnline } = event.detail;
    window.ui.updateUserStatusInUI(userId, isOnline);
  });

  // Switch between Login and Signup forms
  document.getElementById("btn-go-to-signup")?.addEventListener("click", (e) => {
    e.preventDefault();
    showAuthScreen("signup");
  });

  document.getElementById("btn-go-to-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    showAuthScreen("login");
  });

  // Login form submission
  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const loginId = document.getElementById("login-id").value.trim();
    const password = document.getElementById("login-password").value;
    const submitBtn = document.getElementById("btn-login-submit");

    if (!loginId || !password) {
      window.ui.showToast("Please enter your username/email and password.", "error");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Signing In...`;

      const user = await window.auth.login(loginId, password);
      window.ui.showToast(`Welcome back, ${user.display_name}!`, "success");
      onUserAuthenticated(user);
    } catch (err) {
      window.ui.showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Sign In <i class="bi bi-arrow-right"></i>`;
    }
  });

  // Signup form submission
  document.getElementById("signup-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("signup-username").value.trim().toLowerCase();
    const displayName = document.getElementById("signup-displayname").value.trim();
    const email = document.getElementById("signup-email").value.trim().toLowerCase();
    const password = document.getElementById("signup-password").value;
    const submitBtn = document.getElementById("btn-signup-submit");

    if (!username || !email || !password) {
      window.ui.showToast("Please fill in all required fields.", "error");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Creating Account...`;

      const user = await window.auth.register(username, email, password, displayName);
      window.ui.showToast(`Account created! Welcome to Rosé, @${user.username}!`, "success");
      onUserAuthenticated(user);
    } catch (err) {
      window.ui.showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Create Account <i class="bi bi-sparkles"></i>`;
    }
  });

  // Logout Buttons
  document.querySelectorAll(".btn-logout").forEach(btn => {
    btn.addEventListener("click", () => {
      window.auth.logout();
      window.ui.showToast("Logged out successfully.", "info");
      showAuthScreen("login");
    });
  });

  // Nav item buttons
  document.querySelectorAll(".nav-item-btn, .mobile-nav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const view = btn.dataset.view;
      if (view) {
        window.location.hash = `#${view}`;
        window.ui.switchView(view);
      }
    });
  });

  // Search Input Debounce
  let searchTimer = null;
  const searchInput = document.getElementById("search-users-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      const query = e.target.value.trim();
      searchTimer = setTimeout(() => {
        window.ui.loadSearch(query);
      }, window.CONFIG.SEARCH_DEBOUNCE_MS);
    });
  }

  // Profile Form update
  document.getElementById("profile-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const displayName = document.getElementById("profile-displayname-input").value.trim();
    const bio = document.getElementById("profile-bio-input").value.trim();
    const submitBtn = document.getElementById("btn-save-profile");

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Saving...`;

      const res = await window.api.updateProfile(displayName, bio);
      window.auth.updateCurrentUser(res.user);
      window.ui.updateSidebarUserInfo(res.user);
      window.ui.showToast("Profile updated successfully!", "success");
    } catch (err) {
      window.ui.showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Save Changes`;
    }
  });

  // Avatar file upload
  document.getElementById("profile-avatar-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview instantly
    const reader = new FileReader();
    reader.onload = (re) => {
      const preview = document.getElementById("profile-avatar-preview");
      if (preview) preview.src = re.target.result;
    };
    reader.readAsDataURL(file);

    try {
      window.ui.showToast("Uploading avatar...", "info");
      const res = await window.api.uploadAvatar(file);
      window.auth.updateCurrentUser(res.user);
      window.ui.updateSidebarUserInfo(res.user);
      window.ui.showToast("Avatar updated successfully!", "success");
    } catch (err) {
      window.ui.showToast("Failed to upload avatar: " + err.message, "error");
    }
  });

  // Change password form
  document.getElementById("change-password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPass = document.getElementById("current-password-input").value;
    const newPass = document.getElementById("new-password-input").value;
    const confirmPass = document.getElementById("confirm-password-input").value;

    if (newPass !== confirmPass) {
      window.ui.showToast("New passwords do not match.", "error");
      return;
    }

    try {
      await window.api.updatePassword(currentPass, newPass);
      window.ui.showToast("Password updated successfully!", "success");
      e.target.reset();
    } catch (err) {
      window.ui.showToast(err.message, "error");
    }
  });

  // Add Contact Modal submit
  document.getElementById("add-contact-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("modal-contact-username").value.trim().replace(/^@/, '');
    const nickname = document.getElementById("modal-contact-nickname").value.trim();

    try {
      const res = await window.api.addContact(null, username, nickname);
      window.ui.showToast(res.message || "Contact added!", "success");
      window.ui.closeModals();
      e.target.reset();
      window.ui.loadContacts();
    } catch (err) {
      window.ui.showToast(err.message, "error");
    }
  });

  // Close modals
  document.querySelectorAll(".btn-close-modal").forEach(btn => {
    btn.addEventListener("click", () => window.ui.closeModals());
  });

  // =========================================================================
  // Call Controls Event Listeners
  // =========================================================================

  // Incoming Call Actions
  document.getElementById("btn-accept-incoming")?.addEventListener("click", () => {
    window.webrtcManager.acceptIncomingCall();
  });

  document.getElementById("btn-reject-incoming")?.addEventListener("click", () => {
    window.webrtcManager.rejectIncomingCall();
  });

  // Outgoing Call Cancel
  document.getElementById("btn-cancel-outgoing")?.addEventListener("click", () => {
    window.webrtcManager.cancelOutgoingCall();
  });

  // Active Call End
  document.querySelectorAll(".btn-end-call").forEach(btn => {
    btn.addEventListener("click", () => {
      window.webrtcManager.endCurrentCall();
    });
  });

  // Microphone toggle
  document.querySelectorAll(".btn-toggle-mic").forEach(btn => {
    btn.addEventListener("click", () => {
      window.webrtcManager.toggleMicrophone();
    });
  });

  // Camera toggle
  document.querySelectorAll(".btn-toggle-cam").forEach(btn => {
    btn.addEventListener("click", () => {
      window.webrtcManager.toggleCamera();
    });
  });

  // Flip Camera
  document.querySelectorAll(".btn-flip-cam").forEach(btn => {
    btn.addEventListener("click", () => {
      window.webrtcManager.switchCamera();
    });
  });

  // Fullscreen Mode
  document.querySelectorAll(".btn-fullscreen").forEach(btn => {
    btn.addEventListener("click", () => {
      const videoContainer = document.getElementById("active-video-overlay");
      if (!document.fullscreenElement) {
        if (videoContainer.requestFullscreen) {
          videoContainer.requestFullscreen();
        } else if (videoContainer.webkitRequestFullscreen) {
          videoContainer.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });
  });

  // Test ringtone in settings
  document.getElementById("btn-test-ringtone")?.addEventListener("click", () => {
    const btn = document.getElementById("btn-test-ringtone");
    if (btn.dataset.playing === "true") {
      window.soundManager.stopIncomingRingtone();
      btn.dataset.playing = "false";
      btn.innerHTML = `<i class="bi bi-play-fill"></i> Test Ringtone`;
    } else {
      window.soundManager.playIncomingRingtone();
      btn.dataset.playing = "true";
      btn.innerHTML = `<i class="bi bi-stop-fill"></i> Stop Ringtone`;
      setTimeout(() => {
        if (btn.dataset.playing === "true") {
          window.soundManager.stopIncomingRingtone();
          btn.dataset.playing = "false";
          btn.innerHTML = `<i class="bi bi-play-fill"></i> Test Ringtone`;
        }
      }, 6000);
    }
  });

  // =========================================================================
  // Progressive Web App (PWA) Installation Handlers
  // =========================================================================
  let deferredInstallPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log("[PWA] beforeinstallprompt event captured");

    // Display install prompts
    const desktopContainer = document.getElementById("pwa-install-container");
    const mobileBtn = document.getElementById("btn-mobile-pwa-install");
    if (desktopContainer) desktopContainer.style.display = "block";
    if (mobileBtn) mobileBtn.style.display = "inline-flex";
  });

  const triggerPwaInstall = () => {
    if (!deferredInstallPrompt) {
      window.ui.showToast("To install, use the browser menu (e.g. Chrome ⋮ -> Install WebCall)", "info");
      return;
    }

    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("[PWA] User accepted installation");
      }
      deferredInstallPrompt = null;
      const desktopContainer = document.getElementById("pwa-install-container");
      const mobileBtn = document.getElementById("btn-mobile-pwa-install");
      if (desktopContainer) desktopContainer.style.display = "none";
      if (mobileBtn) mobileBtn.style.display = "none";
    });
  };

  document.getElementById("btn-pwa-install")?.addEventListener("click", triggerPwaInstall);
  document.getElementById("btn-mobile-pwa-install")?.addEventListener("click", triggerPwaInstall);

  window.addEventListener("appinstalled", () => {
    window.ui.showToast("Rosé successfully installed as an app!", "success");
    deferredInstallPrompt = null;
  });
}

// =========================================================================
// Register Service Worker for PWA Offline Support & Fast Loading
// =========================================================================
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function initPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("[Push] PushManager not supported in this browser");
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      console.log("[Push] Notification permission:", permission);
      return;
    }

    const { vapidPublicKey } = await window.api.getVapidPublicKey();
    if (!vapidPublicKey) return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    if (sub) {
      await window.api.savePushSubscription(sub);
      console.log("[Push] Push subscription registered and active for background ringing");
    }
  } catch (err) {
    console.warn("[Push] Error initializing push notifications:", err);
  }
}

if ("serviceWorker" in navigator) {
  // Listen for message from service worker when user clicks 'Answer' on background push notification
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "NOTIFICATION_ANSWER_CALL") {
      const callId = event.data.callId;
      if (window.webrtcManager?.currentCall?.callId === callId) {
        window.webrtcManager.acceptIncomingCall();
      } else {
        window.autoAnswerPendingCallId = callId;
      }
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((registration) => {
        console.log("[PWA] Service Worker registered successfully:", registration.scope);
      })
      .catch((error) => {
        console.warn("[PWA] Service Worker registration failed:", error);
      });
  });
}
