/**
 * GramHealth Mock Backend API Connector (js/api.js)
 * -------------------------------------------------------------
 * Simulates RESTful asynchronous server communication endpoints.
 * 
 * In offline mode, operations are stored locally in IndexedDB first.
 * When online, the Sync Engine pushes stored actions to these API endpoints.
 */

const api = {
  // Configurable simulated network latency (ms)
  LATENCY: 600,

  /**
   * Mock API: Fetch all patients from backend server
   * // Replace this function with the real backend API later.
   * Example: return fetch('/api/v1/patients').then(res => res.json());
   */
  async getPatients() {
    console.log('[API Call] GET /api/v1/patients');
    return new Promise((resolve) => {
      setTimeout(async () => {
        const patients = await db.getAll('patients');
        resolve({ status: 200, success: true, data: patients });
      }, this.LATENCY);
    });
  },

  /**
   * Mock API: Create a new patient on backend server
   * // Replace this function with the real backend API later.
   * Example: return fetch('/api/v1/patients', { method: 'POST', body: JSON.stringify(patientData) });
   */
  async createPatient(patientData) {
    console.log('[API Call] POST /api/v1/patients', patientData);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 201,
          success: true,
          message: 'Patient registered on remote server successfully.',
          patientId: patientData.patientId
        });
      }, this.LATENCY);
    });
  },

  /**
   * Mock API: Record vitals log on backend server
   * // Replace this function with the real backend API later.
   */
  async recordVitals(vitalsData) {
    console.log('[API Call] POST /api/v1/vitals', vitalsData);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 201,
          success: true,
          message: 'Vitals synchronized to central health portal.'
        });
      }, this.LATENCY);
    });
  },

  /**
   * Mock API: Create a referral ticket on backend server
   * // Replace this function with the real backend API later.
   */
  async createReferral(referralData) {
    console.log('[API Call] POST /api/v1/referrals', referralData);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 201,
          success: true,
          message: 'Referral dispatched to destination facility.'
        });
      }, this.LATENCY);
    });
  },

  /**
   * Mock API: Process offline synchronization queue payload
   * // Replace this function with the real backend API later.
   * Example: return fetch('/api/v1/sync', { method: 'POST', body: JSON.stringify(batchQueue) });
   */
  async syncData(syncItems) {
    console.log('[API Call] POST /api/v1/sync Batch items count:', syncItems.length);
    return new Promise((resolve) => {
      setTimeout(() => {
        const syncedIds = syncItems.map(item => item.id);
        resolve({
          status: 200,
          success: true,
          syncedCount: syncItems.length,
          syncedIds: syncedIds,
          message: `Successfully synchronized ${syncItems.length} offline items to remote server.`
        });
      }, this.LATENCY + 400);
    });
  }
};
