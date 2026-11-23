/**
 * WebCall API Client
 */
class ApiClient {
  constructor() {
    this.baseUrl = window.CONFIG.BACKEND_URL;
  }

  getToken() {
    return localStorage.getItem("webcall_token");
  }

  setToken(token) {
    if (token) {
      localStorage.setItem("webcall_token", token);
    } else {
      localStorage.removeItem("webcall_token");
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = options.headers || {};

    const token = this.getToken();
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes("/auth/login")) {
          // Token expired or invalid
          this.setToken(null);
          window.dispatchEvent(new CustomEvent("webcall:unauthorized"));
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // Auth endpoints
  async register(username, email, password, displayName, bio) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username,
        email,
        password,
        display_name: displayName,
        bio
      })
    });
  }

  async login(usernameOrEmail, password) {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: usernameOrEmail,
        password
      })
    });
  }

  async getMe() {
    return this.request("/api/auth/me");
  }

  // Users endpoints
  async searchUsers(query) {
    return this.request(`/api/users/search?q=${encodeURIComponent(query || "")}`);
  }

  async getUserProfile(username) {
    return this.request(`/api/users/${encodeURIComponent(username)}`);
  }

  async updateProfile(displayName, bio, avatarUrl) {
    return this.request("/api/users/profile", {
      method: "PUT",
      body: JSON.stringify({
        display_name: displayName,
        bio,
        avatar_url: avatarUrl
      })
    });
  }

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append("avatar", file);
    return this.request("/api/users/avatar", {
      method: "POST",
      body: formData
    });
  }

  async updatePassword(currentPassword, newPassword) {
    return this.request("/api/users/password", {
      method: "PUT",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    });
  }

  // Contacts endpoints
  async getContacts() {
    return this.request("/api/contacts");
  }

  async addContact(contactUserId, username, nickname) {
    return this.request("/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        contact_user_id: contactUserId,
        username,
        nickname
      })
    });
  }

  async removeContact(contactUserId) {
    return this.request(`/api/contacts/${contactUserId}`, {
      method: "DELETE"
    });
  }

  // Call history & statistics
  async getRecentCalls(limit = 50) {
    return this.request(`/api/calls/recent?limit=${limit}`);
  }

  async getMissedCalls() {
    return this.request("/api/calls/missed");
  }

  async getCallStats() {
    return this.request("/api/calls/stats");
  }

  async getIceServers() {
    try {
      const data = await this.request("/api/config/ice");
      return data.iceServers || window.CONFIG.ICE_SERVERS;
    } catch (e) {
      return window.CONFIG.ICE_SERVERS;
    }
  }

  // Web Push Notifications
  async getVapidPublicKey() {
    return this.request("/api/config/vapid-key");
  }

  async savePushSubscription(subscription) {
    const subJson = subscription.toJSON ? subscription.toJSON() : subscription;
    return this.request("/api/users/push-subscription", {
      method: "POST",
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys
      })
    });
  }
}

window.api = new ApiClient();
