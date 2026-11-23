/**
 * WebCall Authentication Manager
 */
class AuthManager {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
  }

  async checkAuth() {
    const token = window.api.getToken();
    if (!token) {
      this.user = null;
      this.isAuthenticated = false;
      return false;
    }

    try {
      const res = await window.api.getMe();
      if (res.success && res.user) {
        this.user = res.user;
        this.isAuthenticated = true;
        return true;
      }
    } catch (err) {
      console.warn("Auth check failed:", err);
    }

    this.logout();
    return false;
  }

  async login(usernameOrEmail, password) {
    const res = await window.api.login(usernameOrEmail, password);
    if (res.success && res.token) {
      window.api.setToken(res.token);
      this.user = res.user;
      this.isAuthenticated = true;
      return res.user;
    }
    throw new Error(res.message || "Login failed");
  }

  async register(username, email, password, displayName, bio) {
    const res = await window.api.register(username, email, password, displayName, bio);
    if (res.success && res.token) {
      window.api.setToken(res.token);
      this.user = res.user;
      this.isAuthenticated = true;
      return res.user;
    }
    throw new Error(res.message || "Registration failed");
  }

  logout() {
    window.api.setToken(null);
    this.user = null;
    this.isAuthenticated = false;
    if (window.socketClient) {
      window.socketClient.disconnect();
    }
  }

  updateCurrentUser(userData) {
    if (this.user) {
      this.user = { ...this.user, ...userData };
    }
  }
}

window.auth = new AuthManager();
