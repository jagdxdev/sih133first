/**
 * GramHealth Synchronization Engine (js/sync.js)
 * -------------------------------------------------------------
 * Offline-First Sync Queue & Connection Manager
 * 
 * Responsibilities:
 * 1. Monitors network online/offline state in real-time.
 * 2. Manages sticky connection status banner in UI.
 * 3. Enqueues offline mutations into IndexedDB `syncQueue`.
 * 4. Auto-flushes sync queue to mock API endpoints when online.
 * 5. Updates local record indicators from `🟠 Pending Sync` to `🟢 Synced`.
 */

class SyncEngine {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
  }

  /**
   * Initializes network status event listeners and banner controls
   */
  init() {
    this.updateStatusUI();

    // Browser Online Event Listener
    window.addEventListener('online', () => {
      console.log('[Sync Engine] Network connection RESTORED. Processing sync queue...');
      this.isOnline = true;
      this.updateStatusUI();
      app.showToast('🟢 Network connection restored. Synchronizing offline queue...', 'success');
      this.processQueue();
    });

    // Browser Offline Event Listener
    window.addEventListener('offline', () => {
      console.log('[Sync Engine] Network connection LOST. Operating in local-first offline mode.');
      this.isOnline = false;
      this.updateStatusUI();
      app.showToast('🟠 You are offline. All entries will save locally and sync automatically when reconnected.', 'warning');
    });
  }

  /**
   * Updates top header sticky connection status banner
   */
  updateStatusUI() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    if (this.isOnline) {
      banner.className = 'online';
      banner.innerHTML = '<span>🟢 Online — Central Health Cloud Connected</span>';
    } else {
      banner.className = 'offline';
      banner.innerHTML = '<span>🟠 Offline Mode — Changes will sync automatically when network is restored</span>';
    }
  }

  /**
   * Adds an action item to the local IndexedDB syncQueue
   * @param {string} action - Action type e.g. 'CREATE_PATIENT', 'RECORD_VITALS', 'CREATE_REFERRAL'
   * @param {string} entity - Target store name ('patients', 'vitals', etc.)
   * @param {object} data - Payload data object
   */
  async enqueue(action, entity, data) {
    const queueItem = {
      action: action,
      entity: entity,
      data: data,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };

    const id = await db.add('syncQueue', queueItem);
    console.log(`[Sync Engine] Action queued offline (ID: ${id}):`, action, entity);

    // If online, trigger queue processing immediately
    if (this.isOnline) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Flushes pending items in IndexedDB syncQueue to the server API
   */
  async processQueue() {
    if (this.isSyncing) return; // Prevent concurrent sync runs

    const pendingItems = await db.getByIndex('syncQueue', 'status', 'PENDING');
    if (pendingItems.length === 0) {
      console.log('[Sync Engine] Sync queue is clean. Nothing to sync.');
      return;
    }

    console.log(`[Sync Engine] Starting sync process for ${pendingItems.length} pending items...`);
    this.isSyncing = true;

    try {
      // Call mock API sync endpoint
      const response = await api.syncData(pendingItems);

      if (response.success) {
        // Mark sync queue items as completed and update local entity sync flags
        for (const item of pendingItems) {
          item.status = 'COMPLETED';
          item.syncedAt = new Date().toISOString();
          await db.update('syncQueue', item);

          // Update underlying entity synced flag
          if (item.entity && item.data) {
            const storeName = item.entity;
            const primaryKeyField = storeName === 'patients' ? 'patientId' : 'id';
            const entityKey = item.data[primaryKeyField];

            if (entityKey) {
              const record = await db.getById(storeName, entityKey);
              if (record) {
                record.synced = true;
                await db.update(storeName, record);
              }
            }
          }
        }

        console.log('[Sync Engine] Offline synchronization completed successfully.');
        app.showToast(`🟢 ${response.message}`, 'success');
        
        // Refresh active UI view to update sync indicators
        if (typeof app !== 'undefined' && app.refreshCurrentView) {
          app.refreshCurrentView();
        }
      }
    } catch (err) {
      console.error('[Sync Engine] Error during synchronization flush:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Returns count of pending offline items
   */
  async getPendingCount() {
    const pendingItems = await db.getByIndex('syncQueue', 'status', 'PENDING');
    return pendingItems.length;
  }
}

// Global Singleton Instance
const syncEngine = new SyncEngine();
