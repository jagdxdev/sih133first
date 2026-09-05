/**
 * GramHealth Authentication & Role Management (js/auth.js)
 * -------------------------------------------------------------
 * Role-Based Login & Session Controller
 * 
 * Supported Accounts & Credentials:
 * 1. ASHA Worker    : username 'asha'   / password 'demo123'
 * 2. PHC Doctor     : username 'doctor' / password 'demo123'
 * 3. District Admin : username 'admin'  / password 'demo123'
 */

const auth = {
  // Mock User Directory
  USERS: {
    'asha': {
      username: 'asha',
      password: 'demo123',
      name: 'Sarita Devi',
      role: 'ASHA',
      roleTitle: 'Frontline ASHA Worker',
      facility: 'Rampur Village Sub-Centre',
      avatarInitials: 'SD'
    },
    'doctor': {
      username: 'doctor',
      password: 'demo123',
      name: 'Dr. Rajesh Sharma',
      role: 'DOCTOR',
      roleTitle: 'PHC Medical Officer',
      facility: 'Rampur Primary Health Centre',
      avatarInitials: 'RS'
    },
    'admin': {
      username: 'admin',
      password: 'demo123',
      name: 'Dr. Ananya Verma',
      role: 'ADMIN',
      roleTitle: 'District Chief Medical Officer',
      facility: 'District Health HQ (Sector 4)',
      avatarInitials: 'AV'
    }
  },

  SESSION_KEY: 'gramhealth_session',

  /**
   * Attempts login with username and password
   * @returns {object} { success: boolean, user: object, message: string }
   */
  login(username, password) {
    const cleanUsername = (username || '').trim().toLowerCase();
    const user = this.USERS[cleanUsername];

    if (!user) {
      return { success: false, message: 'Invalid username. Try "asha", "doctor", or "admin".' };
    }

    if (user.password !== password) {
      return { success: false, message: 'Incorrect password. Default password is "demo123".' };
    }

    // Store active session in localStorage
    const sessionData = {
      username: user.username,
      name: user.name,
      role: user.role,
      roleTitle: user.roleTitle,
      facility: user.facility,
      avatarInitials: user.avatarInitials,
      loginTime: new Date().toISOString()
    };

    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    console.log(`[Auth] User '${user.username}' logged in successfully as ${user.role}.`);

    return { success: true, user: sessionData, message: 'Login successful' };
  },

  /**
   * Clears current active user session
   */
  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    console.log('[Auth] User logged out.');
    window.location.reload();
  },

  /**
   * Retrieves active logged-in user session, or null if unauthenticated
   */
  getCurrentUser() {
    const raw = localStorage.getItem(this.SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      this.logout();
      return null;
    }
  },

  /**
   * Checks if session exists
   */
  isAuthenticated() {
    return this.getCurrentUser() !== null;
  }
};
