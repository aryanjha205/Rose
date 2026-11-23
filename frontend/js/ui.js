/**
 * WebCall UI Renderer & View Coordinator
 */
class UIManager {
  constructor() {
    this.currentView = "dashboard";
  }

  // =========================================================================
  // Toast Notifications
  // =========================================================================

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `custom-toast toast-${type}`;

    let icon = "bi-info-circle-fill";
    if (type === "success") icon = "bi-check-circle-fill";
    if (type === "error") icon = "bi-exclamation-triangle-fill";

    toast.innerHTML = `
      <i class="bi ${icon}" style="font-size: 1.25rem; color: ${type === 'success' ? 'var(--color-online)' : type === 'error' ? 'var(--color-danger)' : 'var(--color-primary)'};"></i>
      <div class="toast-msg">${this.escapeHtml(message)}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 350);
    }, 4000);
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================================
  // Navigation & View Toggling
  // =========================================================================

  switchView(viewName) {
    this.currentView = viewName;

    // Toggle active class on views
    document.querySelectorAll(".app-view").forEach(v => v.classList.remove("active"));
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.add("active");
    }

    // Update active nav button
    document.querySelectorAll(".nav-item-btn, .mobile-nav-btn").forEach(btn => {
      if (btn.dataset.view === viewName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Close any open modals
    this.closeModals();

    // Trigger data loader
    if (viewName === "dashboard") this.loadDashboard();
    if (viewName === "contacts") this.loadContacts();
    if (viewName === "search") this.loadSearch();
    if (viewName === "history") this.loadCalls("all");
    if (viewName === "missed") this.loadCalls("missed");
    if (viewName === "profile") this.loadProfile();
    if (viewName === "settings") this.loadSettings();
  }

  updateSidebarUserInfo(user) {
    if (!user) return;
    const avatarEls = document.querySelectorAll(".current-user-avatar");
    const nameEls = document.querySelectorAll(".current-user-displayname");
    const handleEls = document.querySelectorAll(".current-user-handle");

    avatarEls.forEach(el => el.src = user.avatar_url);
    nameEls.forEach(el => el.textContent = user.display_name);
    handleEls.forEach(el => el.textContent = `@${user.username}`);
  }

  // =========================================================================
  // Real-Time Online Status Sync
  // =========================================================================

  updateUserStatusInUI(userId, isOnline) {
    const indicators = document.querySelectorAll(`[data-user-status-id="${userId}"]`);
    indicators.forEach(ind => {
      if (isOnline) {
        ind.classList.remove("status-offline");
        ind.classList.add("status-online");
      } else {
        ind.classList.remove("status-online");
        ind.classList.add("status-offline");
      }
    });
  }

  // =========================================================================
  // View Data Loaders
  // =========================================================================

  async loadDashboard() {
    const container = document.getElementById("dashboard-content");
    if (!container) return;

    try {
      const [statsRes, contactsRes, callsRes] = await Promise.all([
        window.api.getCallStats().catch(() => ({ stats: {} })),
        window.api.getContacts().catch(() => ({ contacts: [] })),
        window.api.getRecentCalls(5).catch(() => ({ calls: [] }))
      ]);

      const stats = statsRes.stats || {
        total_calls: 0,
        total_duration_minutes: 0,
        voice_calls: 0,
        video_calls: 0,
        missed_calls: 0
      };

      const contacts = contactsRes.contacts || [];
      const calls = callsRes.calls || [];

      // Update badge in sidebar for missed calls
      const missedBadge = document.getElementById("missed-count-badge");
      if (missedBadge) {
        missedBadge.textContent = stats.missed_calls || 0;
        missedBadge.style.display = stats.missed_calls > 0 ? "inline-block" : "none";
      }

      container.innerHTML = `
        <!-- Stats Row -->
        <div class="row g-3 mb-4">
          <div class="col-6 col-md-3">
            <div class="pink-card text-center p-3">
              <div class="text-secondary small fw-bold mb-1">Total Calls</div>
              <div class="fs-3 fw-bold" style="color: var(--color-deep-pink);">${stats.total_calls}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="pink-card text-center p-3">
              <div class="text-secondary small fw-bold mb-1">Talk Time</div>
              <div class="fs-3 fw-bold" style="color: var(--color-primary);">${stats.total_duration_minutes}m</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="pink-card text-center p-3">
              <div class="text-secondary small fw-bold mb-1">Video Calls</div>
              <div class="fs-3 fw-bold" style="color: var(--color-deep-pink);">${stats.video_calls}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="pink-card text-center p-3">
              <div class="text-secondary small fw-bold mb-1">Missed</div>
              <div class="fs-3 fw-bold" style="color: var(--color-danger);">${stats.missed_calls}</div>
            </div>
          </div>
        </div>

        <!-- Quick Actions & Contact Strip -->
        <div class="pink-card mb-4">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h5 class="fw-bold mb-0">Quick Call</h5>
            <button class="btn btn-pink-soft btn-sm" onclick="window.ui.switchView('search')">
              <i class="bi bi-search"></i> Search Users
            </button>
          </div>
          ${contacts.length === 0 ? `
            <div class="text-muted text-center py-3">No contacts saved yet. Search by @username to add friends!</div>
          ` : `
            <div class="d-flex gap-3 overflow-auto pb-2">
              ${contacts.slice(0, 8).map(c => `
                <div class="text-center" style="min-width: 78px; cursor: pointer;" onclick="window.webrtcManager.startCall(${JSON.stringify(c.contact_user).replace(/"/g, '&quot;')}, 'video')">
                  <div class="avatar-container mb-2">
                    <img src="${c.contact_user.avatar_url}" class="avatar-img" width="54" height="54" alt="${this.escapeHtml(c.nickname)}">
                    <span class="status-indicator ${c.contact_user.is_online ? 'status-online' : 'status-offline'}" data-user-status-id="${c.contact_user.id}"></span>
                  </div>
                  <div class="small fw-bold text-truncate" style="max-width: 78px;">${this.escapeHtml(c.nickname)}</div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Recent Calls Snippet -->
        <div class="pink-card p-0 overflow-hidden">
          <div class="d-flex align-items-center justify-content-between p-3 pb-2 border-bottom">
            <h5 class="fw-bold mb-0" style="font-size: 1.1rem;">Recent Activity</h5>
            <button class="btn btn-link text-decoration-none fw-bold p-0" style="color: var(--color-deep-pink); font-size: 0.9rem;" onclick="window.ui.switchView('history')">
              View All <i class="bi bi-chevron-right"></i>
            </button>
          </div>
          <div class="list-group list-group-flush">
            ${calls.length === 0 ? `
              <div class="text-muted text-center py-4">No recent call records. Place your first voice or video call!</div>
            ` : calls.map(c => this.renderCallItemHtml(c)).join('')}
          </div>
        </div>
      `;
    } catch (e) {
      console.error(e);
      container.innerHTML = `<div class="text-danger py-4">Failed to load dashboard data.</div>`;
    }
  }

  updateContactRequestsBadge(count = 0) {
    const sidebarBadge = document.getElementById("contact-requests-badge");
    const mobileBadge = document.getElementById("mobile-contact-requests-badge");
    if (sidebarBadge) {
      sidebarBadge.textContent = count;
      sidebarBadge.style.display = count > 0 ? "inline-block" : "none";
    }
    if (mobileBadge) {
      mobileBadge.textContent = count;
      mobileBadge.style.display = count > 0 ? "inline-block" : "none";
    }
  }

  async loadContacts() {
    const listEl = document.getElementById("contacts-list");
    const reqSection = document.getElementById("pending-requests-section");
    if (!listEl) return;

    listEl.innerHTML = `<div class="p-4 text-center text-muted"><div class="spinner-border text-pink" role="status"></div> Loading contacts...</div>`;

    try {
      const [contactsRes, requestsRes] = await Promise.all([
        window.api.getContacts().catch(() => ({ contacts: [] })),
        window.api.getContactRequests().catch(() => ({ incoming: [], outgoing: [] }))
      ]);

      const contacts = contactsRes.contacts || [];
      const incoming = requestsRes.incoming || [];

      // Update badge
      this.updateContactRequestsBadge(incoming.length);

      // Render Pending Requests Section if any incoming requests exist
      if (reqSection) {
        if (incoming.length > 0) {
          reqSection.style.display = "block";
          reqSection.innerHTML = `
            <div class="pink-card" style="border: 1.5px solid var(--color-primary); background: #FFF9FC;">
              <div class="d-flex align-items-center justify-content-between mb-3">
                <h6 class="fw-bold mb-0" style="color: var(--color-deep-pink);">
                  <i class="bi bi-person-plus-fill"></i> Incoming Contact Requests (${incoming.length})
                </h6>
                <span class="badge-pill-pink">${incoming.length} Waiting Approval</span>
              </div>
              <div class="row g-2">
                ${incoming.map(req => `
                  <div class="col-12 col-md-6">
                    <div class="d-flex align-items-center justify-content-between p-2 rounded-3 bg-white border">
                      <div class="d-flex align-items-center gap-2 min-w-0">
                        <img src="${req.sender?.avatar_url || ''}" class="avatar-img" width="42" height="42" alt="Avatar">
                        <div class="text-truncate">
                          <div class="fw-bold text-truncate" style="font-size: 0.9rem;">${this.escapeHtml(req.sender?.display_name || 'User')}</div>
                          <div class="text-secondary small text-truncate">@${this.escapeHtml(req.sender?.username || '')}</div>
                        </div>
                      </div>
                      <div class="d-flex gap-1 ms-2">
                        <button class="btn btn-sm btn-success rounded-pill px-3 py-1 fw-bold" onclick="window.ui.acceptContactRequest(${req.id})">
                          <i class="bi bi-check-lg"></i> Accept
                        </button>
                        <button class="btn btn-sm btn-pink-soft rounded-pill px-2 py-1" onclick="window.ui.declineContactRequest(${req.id})" title="Decline">
                          <i class="bi bi-x-lg"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        } else {
          reqSection.style.display = "none";
          reqSection.innerHTML = "";
        }
      }

      if (contacts.length === 0) {
        listEl.innerHTML = `
          <div class="pink-card text-center py-5">
            <div class="display-6 mb-3" style="color: var(--color-primary);"><i class="bi bi-people-fill"></i></div>
            <h5 class="fw-bold">No contacts yet</h5>
            <p class="text-secondary small mb-3">Search for users in Find Friends to connect and make instant voice & video calls.</p>
            <button class="btn btn-pink-primary" onclick="window.ui.switchView('search')">
              <i class="bi bi-person-plus-fill"></i> Find Friends
            </button>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div class="row g-3">
          ${contacts.map(c => `
            <div class="col-12 col-md-6 col-xl-4">
              <div class="pink-card pink-card-hover h-100 d-flex flex-column justify-content-between">
                <div>
                  <div class="d-flex align-items-center gap-3 mb-3">
                    <div class="avatar-container">
                      <img src="${c.contact_user.avatar_url}" class="avatar-img" width="56" height="56" alt="${this.escapeHtml(c.nickname)}">
                      <span class="status-indicator ${c.contact_user.is_online ? 'status-online' : 'status-offline'}" data-user-status-id="${c.contact_user.id}"></span>
                    </div>
                    <div class="min-w-0">
                      <h6 class="fw-bold mb-0 text-truncate">${this.escapeHtml(c.nickname)}</h6>
                      <div class="text-secondary small text-truncate">@${this.escapeHtml(c.contact_user.username)}</div>
                      <div class="badge-pill-${c.contact_user.is_online ? 'green' : 'pink'} mt-1" style="font-size: 0.7rem;">
                        ${c.contact_user.is_online ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </div>
                  <p class="text-secondary small mb-3 text-truncate">${this.escapeHtml(c.contact_user.bio || 'Hey there! I am using Rosé. 🌸')}</p>
                </div>
                <div class="d-flex align-items-center justify-content-between pt-2 border-top">
                  <div class="d-flex gap-2">
                    <button class="btn-icon-circle btn-call-voice" title="Voice Call" onclick="window.webrtcManager.startCall(${JSON.stringify(c.contact_user).replace(/"/g, '&quot;')}, 'voice')">
                      <i class="bi bi-telephone-fill"></i>
                    </button>
                    <button class="btn-icon-circle btn-call-video" title="Video Call" onclick="window.webrtcManager.startCall(${JSON.stringify(c.contact_user).replace(/"/g, '&quot;')}, 'video')">
                      <i class="bi bi-camera-video-fill"></i>
                    </button>
                  </div>
                  <button class="btn btn-link text-danger p-0" title="Remove Contact" onclick="window.ui.confirmRemoveContact(${c.contact_user.id}, '${this.escapeHtml(c.nickname)}')">
                    <i class="bi bi-trash3"></i>
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      listEl.innerHTML = `<div class="text-danger p-3">Error loading contacts: ${e.message}</div>`;
    }
  }

  async loadSearch(query = "") {
    const resultsContainer = document.getElementById("search-results-list");
    const searchReqSection = document.getElementById("search-pending-requests-section");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `<div class="p-4 text-center text-muted"><div class="spinner-border text-pink" role="status"></div> Searching friends...</div>`;

    try {
      const [searchRes, reqRes] = await Promise.all([
        window.api.searchUsers(query).catch(() => ({ users: [] })),
        window.api.getContactRequests().catch(() => ({ incoming: [], outgoing: [] }))
      ]);

      const users = searchRes.users || [];
      const incoming = reqRes.incoming || [];

      // Update badge
      this.updateContactRequestsBadge(incoming.length);

      // Render Pending Requests Section in Find Friends if any exist
      if (searchReqSection) {
        if (incoming.length > 0) {
          searchReqSection.style.display = "block";
          searchReqSection.innerHTML = `
            <div class="pink-card" style="border: 2px solid var(--color-primary); background: #FFF9FC;">
              <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <h6 class="fw-bold mb-0" style="color: var(--color-deep-pink); font-size: 1.05rem;">
                  <i class="bi bi-person-check-fill text-pink"></i> Friend Requests Waiting For Your Approval (${incoming.length})
                </h6>
                <span class="badge-pill-pink">${incoming.length} Pending</span>
              </div>
              <div class="row g-2">
                ${incoming.map(req => `
                  <div class="col-12 col-md-6">
                    <div class="d-flex align-items-center justify-content-between p-2 rounded-3 bg-white border">
                      <div class="d-flex align-items-center gap-2 min-w-0">
                        <img src="${req.sender?.avatar_url || ''}" class="avatar-img" width="42" height="42" alt="Avatar">
                        <div class="min-w-0 text-truncate">
                          <div class="fw-bold text-truncate" style="font-size: 0.92rem;">${this.escapeHtml(req.sender?.display_name || 'User')}</div>
                          <div class="text-secondary small text-truncate">@${this.escapeHtml(req.sender?.username || '')}</div>
                        </div>
                      </div>
                      <div class="d-flex align-items-center gap-1 ms-2 flex-shrink-0">
                        <button class="btn btn-sm btn-success rounded-pill px-3 py-1 fw-bold" onclick="window.ui.acceptContactRequest(${req.id})">
                          <i class="bi bi-check-circle-fill"></i> Approve
                        </button>
                        <button class="btn btn-sm btn-pink-soft rounded-pill px-2 py-1" onclick="window.ui.declineContactRequest(${req.id})" title="Decline Request">
                          <i class="bi bi-x-lg"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        } else {
          searchReqSection.style.display = "none";
          searchReqSection.innerHTML = "";
        }
      }

      if (users.length === 0) {
        resultsContainer.innerHTML = `
          <div class="pink-card text-center py-5">
            <i class="bi bi-search display-6 text-muted mb-2"></i>
            <h6 class="fw-bold">No users found</h6>
            <p class="text-secondary small">Try searching with a different username or display name, or invite friends to join Rosé.</p>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = `
        <div class="row g-3">
          ${users.map(u => `
            <div class="col-12 col-md-6 col-xl-4">
              <div class="pink-card pink-card-hover h-100 d-flex flex-column justify-content-between">
                <div>
                  <div class="d-flex align-items-center gap-3 mb-2">
                    <div class="avatar-container">
                      <img src="${u.avatar_url}" class="avatar-img" width="54" height="54" alt="${this.escapeHtml(u.display_name)}">
                      <span class="status-indicator ${u.is_online ? 'status-online' : 'status-offline'}" data-user-status-id="${u.id}"></span>
                    </div>
                    <div class="min-w-0">
                      <h6 class="fw-bold mb-0 text-truncate">${this.escapeHtml(u.display_name)}</h6>
                      <div class="text-secondary small text-truncate">@${this.escapeHtml(u.username)}</div>
                    </div>
                  </div>
                  <p class="text-secondary small mb-3 text-truncate">${this.escapeHtml(u.bio || 'Hey there! I am using Rosé. 🌸')}</p>
                </div>

                <div class="d-flex align-items-center justify-content-between pt-2 border-top">
                  <div class="d-flex gap-2">
                    <button class="btn-icon-circle btn-call-voice" title="Voice Call" onclick="window.webrtcManager.startCall(${JSON.stringify(u).replace(/"/g, '&quot;')}, 'voice')">
                      <i class="bi bi-telephone-fill"></i>
                    </button>
                    <button class="btn-icon-circle btn-call-video" title="Video Call" onclick="window.webrtcManager.startCall(${JSON.stringify(u).replace(/"/g, '&quot;')}, 'video')">
                      <i class="bi bi-camera-video-fill"></i>
                    </button>
                  </div>
                  <div>
                    ${u.is_contact ? `
                      <span class="badge-pill-pink"><i class="bi bi-check2"></i> Contact</span>
                    ` : u.has_sent_request ? `
                      <button class="btn btn-pink-soft btn-sm" onclick="window.ui.cancelContactRequest(${u.pending_request_id})" title="Click to cancel request">
                        <i class="bi bi-hourglass-split"></i> Requested
                      </button>
                    ` : u.has_received_request ? `
                      <div class="d-flex align-items-center gap-1">
                        <button class="btn btn-sm btn-success rounded-pill px-3 py-1 fw-bold" onclick="window.ui.acceptContactRequest(${u.pending_request_id})">
                          <i class="bi bi-check-circle-fill"></i> Approve
                        </button>
                        <button class="btn btn-sm btn-pink-soft rounded-pill px-2 py-1" onclick="window.ui.declineContactRequest(${u.pending_request_id})" title="Decline Request">
                          <i class="bi bi-x-lg"></i>
                        </button>
                      </div>
                    ` : `
                      <button class="btn btn-pink-primary btn-sm" onclick="window.ui.sendContactRequest(${u.id}, '${this.escapeHtml(u.username)}')">
                        <i class="bi bi-person-plus-fill"></i> Add Contact
                      </button>
                    `}
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      resultsContainer.innerHTML = `<div class="text-danger p-3">Search error: ${e.message}</div>`;
    }
  }

  async loadCalls(filter = "all") {
    const listEl = document.getElementById(filter === "missed" ? "missed-calls-list" : "all-calls-list");
    if (!listEl) return;

    listEl.innerHTML = `<div class="p-4 text-center text-muted"><div class="spinner-border text-pink" role="status"></div> Loading call logs...</div>`;

    try {
      const res = filter === "missed" ? await window.api.getMissedCalls() : await window.api.getRecentCalls(100);
      const calls = res.calls || [];

      if (calls.length === 0) {
        listEl.innerHTML = `
          <div class="pink-card text-center py-5">
            <i class="bi bi-telephone-x display-6 text-muted mb-2"></i>
            <h6 class="fw-bold">${filter === 'missed' ? 'No missed calls' : 'No call history yet'}</h6>
            <p class="text-secondary small">Your incoming, outgoing, and missed call history will appear here.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div class="pink-card p-0 overflow-hidden">
          <div class="list-group list-group-flush">
            ${calls.map(c => this.renderCallItemHtml(c)).join('')}
          </div>
        </div>
      `;
    } catch (e) {
      listEl.innerHTML = `<div class="text-danger p-3">Error loading calls: ${e.message}</div>`;
    }
  }

  renderCallItemHtml(c) {
    const other = c.other_user || {};
    const isVoice = c.call_type === "voice";
    const isOutgoing = c.is_outgoing;
    const isMissed = c.status === "missed";
    const isRejected = c.status === "rejected";

    let statusIcon = "bi-telephone-inbound";
    let statusClass = "text-success";
    let statusLabel = "Incoming";

    if (isOutgoing) {
      statusIcon = "bi-telephone-outbound";
      statusClass = "text-primary";
      statusLabel = "Outgoing";
    }
    if (isMissed) {
      statusIcon = "bi-telephone-x";
      statusClass = "text-danger";
      statusLabel = "Missed";
    }
    if (isRejected) {
      statusIcon = "bi-slash-circle";
      statusClass = "text-danger";
      statusLabel = "Declined";
    }

    const durationText = c.duration_seconds > 0
      ? window.webrtcManager.formatDuration(c.duration_seconds)
      : (isMissed ? "Missed" : "00:00");

    let timeFormatted = "";
    if (c.created_at) {
      const d = new Date(c.created_at);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
      timeFormatted = isToday ? `Today, ${timeStr}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
    }

    return `
      <div class="list-group-item d-flex align-items-center justify-content-between p-3 border-light">
        <div class="d-flex align-items-center gap-2 gap-sm-3 min-w-0 flex-grow-1 me-2">
          <div class="avatar-container flex-shrink-0">
            <img src="${other.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + (other.username || 'User')}" class="avatar-img" width="42" height="42" alt="${this.escapeHtml(other.display_name || 'User')}">
            <span class="status-indicator ${other.is_online ? 'status-online' : 'status-offline'}" data-user-status-id="${other.id}"></span>
          </div>
          <div class="min-w-0 flex-grow-1">
            <div class="d-flex align-items-center gap-2">
              <span class="fw-bold text-truncate" style="max-width: 130px; font-size: 0.92rem;">${this.escapeHtml(other.display_name || other.username || 'Unknown')}</span>
              <span class="badge ${isMissed ? 'badge-pill-red' : 'badge-pill-pink'} flex-shrink-0" style="font-size: 0.68rem; padding: 0.2rem 0.5rem; white-space: nowrap;">
                <i class="bi ${statusIcon}"></i> ${statusLabel}
              </span>
            </div>
            <div class="text-secondary small d-flex align-items-center flex-wrap gap-2 mt-1" style="font-size: 0.76rem; line-height: 1.3;">
              <span class="text-nowrap" style="white-space: nowrap;"><i class="bi ${isVoice ? 'bi-telephone' : 'bi-camera-video'}"></i> ${isVoice ? 'Voice' : 'Video'}</span>
              ${c.duration_seconds > 0 ? `<span>•</span><span class="text-nowrap" style="white-space: nowrap;">${durationText}</span>` : ''}
              <span>•</span>
              <span class="text-nowrap text-muted" style="white-space: nowrap;">${timeFormatted}</span>
            </div>
          </div>
        </div>

        <div class="d-flex align-items-center gap-1 gap-sm-2 flex-shrink-0">
          <button class="btn-icon-circle btn-call-voice btn-call-action" title="Call Again (Voice)" onclick="window.webrtcManager.startCall(${JSON.stringify(other).replace(/"/g, '&quot;')}, 'voice')">
            <i class="bi bi-telephone-fill"></i>
          </button>
          <button class="btn-icon-circle btn-call-video btn-call-action" title="Call Again (Video)" onclick="window.webrtcManager.startCall(${JSON.stringify(other).replace(/"/g, '&quot;')}, 'video')">
            <i class="bi bi-camera-video-fill"></i>
          </button>
        </div>
      </div>
    `;
  }

  loadProfile() {
    const user = window.auth.user;
    if (!user) return;

    const nameInput = document.getElementById("profile-displayname-input");
    const bioInput = document.getElementById("profile-bio-input");
    const emailInput = document.getElementById("profile-email-input");
    const usernameInput = document.getElementById("profile-username-input");
    const avatarPreview = document.getElementById("profile-avatar-preview");

    if (nameInput) nameInput.value = user.display_name || "";
    if (bioInput) bioInput.value = user.bio || "";
    if (emailInput) emailInput.value = user.email || "";
    if (usernameInput) usernameInput.value = user.username || "";
    if (avatarPreview) avatarPreview.src = user.avatar_url || "";
  }

  async loadSettings() {
    // Populate audio & video device choices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const micSelect = document.getElementById("settings-mic-select");
      const camSelect = document.getElementById("settings-cam-select");

      if (micSelect) {
        micSelect.innerHTML = devices
          .filter(d => d.kind === "audioinput")
          .map(d => `<option value="${d.deviceId}">${this.escapeHtml(d.label || 'Default Microphone')}</option>`)
          .join('') || '<option value="">Default Microphone</option>';
      }

      if (camSelect) {
        camSelect.innerHTML = devices
          .filter(d => d.kind === "videoinput")
          .map(d => `<option value="${d.deviceId}">${this.escapeHtml(d.label || 'Default Camera')}</option>`)
          .join('') || '<option value="">Default Camera</option>';
      }
    } catch (e) {
      console.warn("Device enumeration not available:", e);
    }
  }

  // =========================================================================
  // Call Overlay Screens
  // =========================================================================

  showIncomingCallScreen(caller, callType) {
    const overlay = document.getElementById("incoming-call-overlay");
    if (!overlay) return;

    document.getElementById("incoming-avatar").src = caller.avatar_url;
    document.getElementById("incoming-name").textContent = caller.display_name;
    document.getElementById("incoming-handle").textContent = `@${caller.username}`;
    document.getElementById("incoming-type-text").textContent = `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call...`;

    overlay.classList.add("active");
  }

  hideIncomingCallScreen() {
    const overlay = document.getElementById("incoming-call-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  showOutgoingCallScreen(receiver, callType) {
    const overlay = document.getElementById("outgoing-call-overlay");
    if (!overlay) return;

    document.getElementById("outgoing-avatar").src = receiver.avatar_url;
    document.getElementById("outgoing-name").textContent = receiver.display_name;
    document.getElementById("outgoing-handle").textContent = `@${receiver.username}`;
    document.getElementById("outgoing-type-text").textContent = `Calling ${callType === 'video' ? 'Video' : 'Voice'}...`;

    overlay.classList.add("active");
  }

  hideOutgoingCallScreen() {
    const overlay = document.getElementById("outgoing-call-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  showActiveCallScreen(peer, callType) {
    this.hideIncomingCallScreen();
    this.hideOutgoingCallScreen();

    if (callType === "video") {
      const videoOverlay = document.getElementById("active-video-overlay");
      if (videoOverlay) {
        document.getElementById("video-peer-avatar").src = peer.avatar_url;
        document.getElementById("video-peer-name").textContent = peer.display_name;
        document.getElementById("video-call-timer").textContent = "00:00";
        videoOverlay.classList.add("active");
      }
    } else {
      // Voice call
      const voiceOverlay = document.getElementById("active-voice-overlay");
      if (voiceOverlay) {
        document.getElementById("voice-peer-avatar").src = peer.avatar_url;
        document.getElementById("voice-peer-name").textContent = peer.display_name;
        document.getElementById("voice-peer-handle").textContent = `@${peer.username}`;
        document.getElementById("voice-call-timer").textContent = "00:00";
        voiceOverlay.classList.add("active");
      }
    }
  }

  hideAllCallScreens() {
    this.hideIncomingCallScreen();
    this.hideOutgoingCallScreen();

    const videoOverlay = document.getElementById("active-video-overlay");
    if (videoOverlay) videoOverlay.classList.remove("active");

    const voiceOverlay = document.getElementById("active-voice-overlay");
    if (voiceOverlay) voiceOverlay.classList.remove("active");
  }

  updateCallDuration(formatted) {
    const vTimer = document.getElementById("voice-call-timer");
    if (vTimer) vTimer.textContent = formatted;

    const vidTimer = document.getElementById("video-call-timer");
    if (vidTimer) vidTimer.textContent = formatted;
  }

  updateMicButtonState(isMuted) {
    document.querySelectorAll(".btn-toggle-mic").forEach(btn => {
      const icon = btn.querySelector("i");
      const sub = btn.querySelector(".ctrl-subtext");
      if (isMuted) {
        btn.classList.add("btn-muted-state");
        if (icon) icon.className = "bi bi-mic-mute-fill";
        if (sub) sub.textContent = "Muted";
      } else {
        btn.classList.remove("btn-muted-state");
        if (icon) icon.className = "bi bi-mic-fill";
        if (sub) sub.textContent = "Mic";
      }
    });
  }

  updateCameraButtonState(isCameraOff) {
    document.querySelectorAll(".btn-toggle-cam").forEach(btn => {
      const icon = btn.querySelector("i");
      const sub = btn.querySelector(".ctrl-subtext");
      if (isCameraOff) {
        btn.classList.add("btn-muted-state");
        if (icon) icon.className = "bi bi-camera-video-off-fill";
        if (sub) sub.textContent = "Off";
      } else {
        btn.classList.remove("btn-muted-state");
        if (icon) icon.className = "bi bi-camera-video-fill";
        if (sub) sub.textContent = "Cam";
      }
    });

    const placeholder = document.getElementById("remote-video-placeholder");
    if (placeholder) {
      if (isCameraOff) placeholder.classList.add("active");
      else placeholder.classList.remove("active");
    }
  }

  // =========================================================================
  // Contact Actions & Modals
  // =========================================================================

  openAddContactModal(prefillUsername = "") {
    const input = document.getElementById("modal-contact-username");
    if (input) input.value = prefillUsername;
    const modal = document.getElementById("add-contact-modal");
    if (modal) modal.classList.add("active");
  }

  closeModals() {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
  }

  async sendContactRequest(userId, username) {
    try {
      const res = await window.api.sendContactRequest(userId, username);
      this.showToast(res.message || "Contact request sent!", "success");
      if (this.currentView === "search") {
        const query = document.getElementById("search-users-input")?.value;
        this.loadSearch(query);
      } else if (this.currentView === "contacts") {
        this.loadContacts();
      }
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async acceptContactRequest(requestId) {
    try {
      const res = await window.api.acceptContactRequest(requestId);
      this.showToast(res.message || "Contact request accepted!", "success");
      this.loadContacts();
      if (this.currentView === "search") {
        const query = document.getElementById("search-users-input")?.value;
        this.loadSearch(query);
      }
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async declineContactRequest(requestId) {
    try {
      const res = await window.api.declineContactRequest(requestId);
      this.showToast(res.message || "Contact request declined", "info");
      this.loadContacts();
      if (this.currentView === "search") {
        const query = document.getElementById("search-users-input")?.value;
        this.loadSearch(query);
      }
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async cancelContactRequest(requestId) {
    try {
      const res = await window.api.cancelContactRequest(requestId);
      this.showToast(res.message || "Contact request cancelled", "info");
      if (this.currentView === "search") {
        const query = document.getElementById("search-users-input")?.value;
        this.loadSearch(query);
      } else if (this.currentView === "contacts") {
        this.loadContacts();
      }
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  async quickAddContact(userId, username) {
    return this.sendContactRequest(userId, username);
  }

  async confirmRemoveContact(contactUserId, name) {
    if (!confirm(`Are you sure you want to remove ${name} from your contacts?`)) return;
    try {
      await window.api.removeContact(contactUserId);
      this.showToast("Contact removed", "info");
      this.loadContacts();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }
}

window.ui = new UIManager();
