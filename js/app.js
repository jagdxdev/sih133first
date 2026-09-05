/**
 * GramHealth Main Application Controller (js/app.js)
 * -------------------------------------------------------------
 * Application Orchestrator & View Router
 * 
 * Functions:
 * 1. Registers Service Worker (sw.js) for PWA offline capabilities.
 * 2. Initializes IndexedDB database & Offline Sync Engine.
 * 3. Controls Role-Based Navigation & View Switching (ASHA, Doctor, Admin).
 * 4. Manages global modal popups, toasts, and DOM utilities.
 */

const app = {
  activeView: 'dashboard',

  /**
   * Application Bootstrapper
   */
  async init() {
    console.log('[GramHealth App] Initializing application...');

    // 1. Register Service Worker for PWA Offline Caching
    this.registerServiceWorker();

    // 2. Initialize IndexedDB Database
    try {
      await db.init();
      console.log('[GramHealth App] IndexedDB ready.');
    } catch (err) {
      console.error('[GramHealth App] Database initialization error:', err);
    }

    // 3. Initialize Sync Engine
    syncEngine.init();

    // 4. Render Interface based on Authentication State
    this.renderAppShell();
  },

  /**
   * Registers Progressive Web App (PWA) Service Worker
   */
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[Service Worker] Registered successfully with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[Service Worker] Registration failed:', err);
          });
      });
    } else {
      console.log('[Service Worker] Not supported in this browser environment.');
    }
  },

  /**
   * Renders the application shell based on active user session
   */
  renderAppShell() {
    const appContainer = document.getElementById('app');
    const user = auth.getCurrentUser();

    if (!user) {
      // User is not logged in: Render Auth / Login Screen
      appContainer.innerHTML = this.getLoginViewTemplate();
      return;
    }

    // User is logged in: Render Dashboard Shell with Sidebar & Navigation
    appContainer.innerHTML = `
      <!-- Sticky Offline Banner -->
      <div id="offline-banner"></div>

      <div class="app-layout">
        <!-- Sidebar Navigation -->
        <aside class="app-sidebar">
          <div class="sidebar-header">
            <div class="brand-title">
              <span>🩺</span> GramHealth PWA
            </div>
          </div>

          <!-- Logged-in User Badge -->
          <div class="user-badge">
            <div class="user-avatar">${user.avatarInitials || 'GH'}</div>
            <div class="user-details">
              <h4>${this.escapeHtml(user.name)}</h4>
              <span>${user.roleTitle}</span>
            </div>
          </div>

          <!-- Navigation Links -->
          <nav class="sidebar-nav">
            <button class="nav-item active" id="nav-dashboard" onclick="app.switchView('dashboard')">
              <span>📊</span> ${user.role} Dashboard
            </button>
            <button class="nav-item" id="nav-sync" onclick="app.triggerManualSync()">
              <span>🔄</span> Force Manual Sync
            </button>
          </nav>

          <!-- Sidebar Footer Logout -->
          <div class="sidebar-footer">
            <button class="btn-logout" onclick="auth.logout()">
              🚪 Logout Session
            </button>
          </div>
        </aside>

        <!-- Main Content Workstation Area -->
        <main class="app-main" id="main-content">
          <!-- Rendered dynamically by active role module -->
        </main>
      </div>

      <!-- Container for Floating Toast Alerts -->
      <div id="toast-container"></div>
    `;

    // Update banner status right after DOM load
    syncEngine.updateStatusUI();

    // Render active role dashboard view
    this.renderRoleDashboard();
  },

  /**
   * Renders role-specific view (ASHA, Doctor, Admin)
   */
  async renderRoleDashboard() {
    const user = auth.getCurrentUser();
    const mainContent = document.getElementById('main-content');
    if (!mainContent || !user) return;

    if (user.role === 'ASHA') {
      await ashaModule.renderDashboard(mainContent);
    } else if (user.role === 'DOCTOR') {
      await doctorModule.renderDashboard(mainContent);
    } else if (user.role === 'ADMIN') {
      await adminModule.renderDashboard(mainContent);
    }
  },

  /**
   * Refreshes active view when offline data or sync status changes
   */
  refreshCurrentView() {
    this.renderRoleDashboard();
  },

  /**
   * Returns HTML Template for Login View
   */
  getLoginViewTemplate() {
    return `
      <!-- Sticky Offline Banner -->
      <div id="offline-banner"></div>

      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <div class="logo-badge">
              <span>🩺</span> GramHealth
            </div>
            <h1>Rural Public Healthcare PWA</h1>
            <p>Offline-First Workstation for ASHA Workers, Doctors & Admins</p>
          </div>

          <form id="login-form" onsubmit="app.handleLoginSubmit(event)">
            <div class="form-group">
              <label for="login-username">Username *</label>
              <input type="text" id="login-username" required placeholder="e.g. asha, doctor, or admin">
            </div>

            <div class="form-group">
              <label for="login-password">Password *</label>
              <input type="password" id="login-password" required placeholder="Default password is demo123">
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 8px;">
              🔐 Sign In to Workstation
            </button>
          </form>

          <!-- Quick Access Credentials Helper -->
          <div class="auth-credentials-hint">
            <strong>💡 Demonstration Accounts (Click to Auto-fill):</strong>
            <table>
              <tr onclick="app.autofillLogin('asha', 'demo123')" style="cursor:pointer;">
                <td><strong>ASHA Worker:</strong></td>
                <td><code>asha</code></td>
                <td><code>demo123</code></td>
              </tr>
              <tr onclick="app.autofillLogin('doctor', 'demo123')" style="cursor:pointer;">
                <td><strong>PHC Doctor:</strong></td>
                <td><code>doctor</code></td>
                <td><code>demo123</code></td>
              </tr>
              <tr onclick="app.autofillLogin('admin', 'demo123')" style="cursor:pointer;">
                <td><strong>District Admin:</strong></td>
                <td><code>admin</code></td>
                <td><code>demo123</code></td>
              </tr>
            </table>
          </div>
        </div>
      </div>
      <div id="toast-container"></div>
    `;
  },

  /**
   * Auto-fills credentials for easy demo testing
   */
  autofillLogin(user, pass) {
    const uInput = document.getElementById('login-username');
    const pInput = document.getElementById('login-password');
    if (uInput && pInput) {
      uInput.value = user;
      pInput.value = pass;
    }
  },

  /**
   * Handles login form submit
   */
  handleLoginSubmit(event) {
    event.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;

    const result = auth.login(u, p);
    if (result.success) {
      this.renderAppShell();
      this.showToast(`Welcome back, ${result.user.name}!`, 'success');
    } else {
      this.showToast(result.message, 'danger');
    }
  },

  /**
   * Triggers manual synchronization execution
   */
  async triggerManualSync() {
    this.showToast('🔄 Manual sync triggered...', 'warning');
    await syncEngine.processQueue();
  },

  /**
   * Modal helper: Appends raw modal HTML to body
   */
  openModalRaw(modalHtml) {
    this.closeAllModals();
    const div = document.createElement('div');
    div.id = 'active-modal-wrapper';
    div.innerHTML = modalHtml;
    document.body.appendChild(div);
  },

  /**
   * Closes modal by ID or wrapper
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      const overlay = modal.closest('.modal-overlay') || modal;
      overlay.remove();
    }
    this.closeAllModals();
  },

  closeAllModals() {
    const wrapper = document.getElementById('active-modal-wrapper');
    if (wrapper) wrapper.remove();
  },

  /**
   * Displays a floating toast notification banner
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '🚨'}</span> <span>${this.escapeHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  },

  /**
   * Helper: Sanitizes string input to prevent XSS injection
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Initialize Application when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
