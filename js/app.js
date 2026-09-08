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
 * 5. PWA Install Prompt (Android/Chrome) & iOS install instructions.
 */

// ─── PWA Install Prompt Global Handler ───────────────────────────────────────
let _pwaInstallPrompt = null;   // Holds the deferred beforeinstallprompt event
let _isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
let _isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
                        || window.navigator.standalone === true;

// Capture the install prompt (Android / Chrome / Edge)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _pwaInstallPrompt = e;
  // Show the install banner if it was injected already
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.style.display = 'flex';
  // Activate any install buttons
  document.querySelectorAll('.pwa-install-btn').forEach(btn => btn.style.display = 'inline-flex');
});

// Hide banner once the app is installed
window.addEventListener('appinstalled', () => {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
  document.querySelectorAll('.pwa-install-btn').forEach(btn => btn.remove());
  _pwaInstallPrompt = null;
});

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

    // 4. Inject PWA install banner into DOM (hidden until event fires)
    this.injectInstallBanner();

    // 5. Render Interface based on Authentication State
    this.renderAppShell();
  },

  /**
   * Injects the bottom PWA install banner into the page body.
   * Shown automatically when browser fires beforeinstallprompt.
   * Also shows on iOS with Safari-specific instructions.
   */
  injectInstallBanner() {
    if (_isInStandaloneMode) return; // Already installed — skip
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';

    if (_isIOS) {
      // iOS cannot use beforeinstallprompt — show static Safari instructions
      banner.style.display = 'flex';
      banner.innerHTML = `
        <div class="pwa-banner-icon">📲</div>
        <div class="pwa-banner-text">
          <strong>Install GramHealth</strong>
          <span>Tap <b>Share</b> <span style="font-size:1.1em;">⎙</span> → <b>"Add to Home Screen"</b> in Safari</span>
        </div>
        <button class="pwa-banner-dismiss" onclick="this.closest('#pwa-install-banner').remove()" title="Dismiss">✕</button>
      `;
    } else {
      // Android / Chrome — hidden until beforeinstallprompt fires
      banner.style.display = 'none';
      banner.innerHTML = `
        <div class="pwa-banner-icon">📲</div>
        <div class="pwa-banner-text">
          <strong>Install GramHealth</strong>
          <span>Add to your home screen for offline access</span>
        </div>
        <button class="pwa-banner-install" id="pwa-banner-install-btn" onclick="app.triggerInstallPrompt()">Install App</button>
        <button class="pwa-banner-dismiss" onclick="this.closest('#pwa-install-banner').remove()" title="Dismiss">✕</button>
      `;
    }

    document.body.appendChild(banner);
  },

  /**
   * Triggers the native browser PWA install dialog (Android/Chrome/Edge)
   */
  async triggerInstallPrompt() {
    if (_pwaInstallPrompt) {
      _pwaInstallPrompt.prompt();
      const { outcome } = await _pwaInstallPrompt.userChoice;
      console.log('[PWA Install] User choice:', outcome);
      if (outcome === 'accepted') {
        this.showToast('✅ GramHealth installed successfully!', 'success');
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.remove();
        _pwaInstallPrompt = null;
      }
    } else if (_isIOS) {
      this.showIOSInstallModal();
    } else {
      this.showToast('Open this app in Chrome on Android to install it.', 'info');
    }
  },

  /**
   * Shows a modal with step-by-step iOS install instructions
   */
  showIOSInstallModal() {
    this.openModalRaw(`
      <div class="modal-overlay" onclick="if(event.target===this)app.closeAllModals()">
        <div class="modal-card" style="max-width:360px;">
          <div class="modal-header">
            <h3>📲 Install on iPhone / iPad</h3>
            <button class="modal-close" onclick="app.closeAllModals()">✕</button>
          </div>
          <div class="modal-body">
            <div class="ios-install-steps">
              <div class="ios-step">
                <div class="ios-step-num">1</div>
                <div>Open this page in <strong>Safari</strong> browser<br><small style="color:var(--text-muted)">(Chrome on iOS cannot install PWAs)</small></div>
              </div>
              <div class="ios-step">
                <div class="ios-step-num">2</div>
                <div>Tap the <strong>Share</strong> button <span style="font-size:1.3em;">⎙</span> at the bottom of Safari</div>
              </div>
              <div class="ios-step">
                <div class="ios-step-num">3</div>
                <div>Scroll down and tap <strong>"Add to Home Screen"</strong></div>
              </div>
              <div class="ios-step">
                <div class="ios-step-num">4</div>
                <div>Tap <strong>"Add"</strong> in the top right corner</div>
              </div>
            </div>
            <div style="margin-top:1rem;padding:0.75rem;background:#f0fdf4;border-radius:8px;font-size:0.85rem;color:#16a34a;">
              ✅ Sarthi will appear on your Home Screen like a native app!
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="app.closeAllModals()">Got it!</button>
          </div>
        </div>
      </div>
    `);
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
              <span>🩺</span> Sarthi
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
            ${!_isInStandaloneMode ? `
            <button class="nav-item pwa-install-btn" id="sidebar-install-btn"
              onclick="app.triggerInstallPrompt()"
              style="display:none;background:linear-gradient(135deg,rgba(13,148,136,0.2),rgba(2,132,199,0.2));border:1px solid rgba(13,148,136,0.4);">
              <span>📲</span> Install App
            </button>` : ''}
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
    // Determine install button label for login card
    const showInstallBtn = !_isInStandaloneMode;
    const installBtnHtml = showInstallBtn ? `
      <button type="button" class="btn pwa-install-btn" id="login-install-btn"
        onclick="app.triggerInstallPrompt()"
        style="width:100%;margin-top:6px;background:linear-gradient(135deg,#0d9488,#0284c7);color:#fff;display:none;">
        📲 Install App on This Device
      </button>` : '';

    return `
      <!-- Sticky Offline Banner -->
      <div id="offline-banner"></div>

      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <div class="logo-badge">
              <span>🩺</span> Sarthi
            </div>
            <h1>Rural Public Healthcare</h1>
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

          ${installBtnHtml}

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
