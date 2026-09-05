/**
 * GramHealth Database Layer (js/db.js)
 * -------------------------------------------------------------
 * Promisified IndexedDB Wrapper for Local-First Storage.
 * 
 * Provides persistent offline storage for:
 * - Patients
 * - Vitals & Visits
 * - Triage Records
 * - Referrals
 * - Maternal & Child Follow-ups
 * - Offline Sync Queue
 * - Medicine & Inventory Stock
 */

const DB_NAME = 'GramHealthDB';
const DB_VERSION = 1;

class GramHealthDB {
  constructor() {
    this.db = null;
  }

  /**
   * Initializes IndexedDB database, creates object stores, and seeds mock data on first launch.
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // Triggered when database version changes or is created for the first time
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[IndexedDB] Upgrading schema / Initializing Object Stores...');

        // 1. Patients Store (Key: patientId)
        if (!db.objectStoreNames.contains('patients')) {
          const patientStore = db.createObjectStore('patients', { keyPath: 'patientId' });
          patientStore.createIndex('name', 'name', { unique: false });
          patientStore.createIndex('mobile', 'mobile', { unique: false });
          patientStore.createIndex('village', 'village', { unique: false });
          patientStore.createIndex('riskLevel', 'riskLevel', { unique: false });
        }

        // 2. Vitals & Visit Logs Store (Auto-increment ID)
        if (!db.objectStoreNames.contains('vitals')) {
          const vitalsStore = db.createObjectStore('vitals', { keyPath: 'id', autoIncrement: true });
          vitalsStore.createIndex('patientId', 'patientId', { unique: false });
          vitalsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 3. Digital Triage Records Store
        if (!db.objectStoreNames.contains('triage')) {
          const triageStore = db.createObjectStore('triage', { keyPath: 'id', autoIncrement: true });
          triageStore.createIndex('patientId', 'patientId', { unique: false });
          triageStore.createIndex('category', 'category', { unique: false });
        }

        // 4. Referrals Store
        if (!db.objectStoreNames.contains('referrals')) {
          const referralStore = db.createObjectStore('referrals', { keyPath: 'id', autoIncrement: true });
          referralStore.createIndex('patientId', 'patientId', { unique: false });
          referralStore.createIndex('status', 'status', { unique: false });
          referralStore.createIndex('priority', 'priority', { unique: false });
        }

        // 5. Follow-ups Store (Maternal & Child Healthcare)
        if (!db.objectStoreNames.contains('followups')) {
          const followupStore = db.createObjectStore('followups', { keyPath: 'id', autoIncrement: true });
          followupStore.createIndex('patientId', 'patientId', { unique: false });
          followupStore.createIndex('status', 'status', { unique: false });
          followupStore.createIndex('type', 'type', { unique: false });
        }

        // 6. Sync Queue Store (For Offline -> Online background synchronization)
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('status', 'status', { unique: false });
        }

        // 7. Inventory & Medicine Stock Store
        if (!db.objectStoreNames.contains('inventory')) {
          const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id' });
          inventoryStore.createIndex('facilityId', 'facilityId', { unique: false });
          inventoryStore.createIndex('itemName', 'itemName', { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        console.log('[IndexedDB] Database connected successfully.');
        
        // Seed initial data if database is empty
        await this._seedMockDataIfEmpty();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[IndexedDB] Database connection error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Helper: Promisified Transaction Wrapper for Reading All Records in a Store
   */
  async getAll(storeName) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper: Promisified Transaction Wrapper for Getting a Single Record by ID
   */
  async getById(storeName, id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper: Query Store using Index
   */
  async getByIndex(storeName, indexName, value) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper: Add a Record to a Store
   */
  async add(storeName, item) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper: Update or Put a Record into a Store
   */
  async update(storeName, item) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper: Delete a Record from a Store
   */
  async delete(storeName, id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Seeds realistic mock dataset on first application launch
   */
  async _seedMockDataIfEmpty() {
    const existingPatients = await this.getAll('patients');
    if (existingPatients.length > 0) return; // Already seeded

    console.log('[IndexedDB] First launch detected. Seeding mock rural healthcare data...');

    // 1. Mock Patients
    const mockPatients = [
      {
        patientId: 'P-10245',
        name: 'Sunita Devi',
        age: 28,
        gender: 'Female',
        mobile: '9876543210',
        village: 'Rampur',
        emergencyContact: 'Ramesh Kumar (Husband) - 9876543211',
        symptoms: 'High fever, severe headache, fatigue',
        complaint: 'Fever since 3 days, body ache',
        diseases: 'None',
        medicines: 'Paracetamol 500mg (self-medicated)',
        allergies: 'Penicillin',
        riskLevel: 'YELLOW',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        synced: true
      },
      {
        patientId: 'P-10246',
        name: 'Ram Charan',
        age: 62,
        gender: 'Male',
        mobile: '9812345678',
        village: 'Sundarpur',
        emergencyContact: 'Suresh Charan (Son) - 9812345679',
        symptoms: 'Shortness of breath, chest pressure, dizziness',
        complaint: 'Sudden chest discomfort after walking',
        diseases: 'Hypertension, Diabetes Type 2',
        medicines: 'Amlodipine 5mg, Metformin 500mg',
        allergies: 'None',
        riskLevel: 'RED',
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        synced: true
      },
      {
        patientId: 'P-10247',
        name: 'Priya Sharma',
        age: 24,
        gender: 'Female',
        mobile: '9765432109',
        village: 'Kheda',
        emergencyContact: 'Mohan Sharma (Father) - 9765432110',
        symptoms: 'Mild nausea, ANC 2nd Trimester checkup',
        complaint: 'Routine ANC visit, minor nausea',
        diseases: 'Anemia (Mild)',
        medicines: 'Iron & Folic Acid tablets',
        allergies: 'None',
        riskLevel: 'GREEN',
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
        synced: true
      },
      {
        patientId: 'P-10248',
        name: 'Aarav Kumar',
        age: 3,
        gender: 'Male',
        mobile: '9654321098',
        village: 'Rampur',
        emergencyContact: 'Meena Kumar (Mother) - 9654321098',
        symptoms: 'Cough, mild fever',
        complaint: 'Pediatric checkup, cough since yesterday',
        diseases: 'None',
        medicines: 'Syrup Paracetamol',
        allergies: 'None',
        riskLevel: 'GREEN',
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        synced: true
      }
    ];

    for (const p of mockPatients) {
      await this.add('patients', p);
    }

    // 2. Mock Vitals
    const mockVitals = [
      {
        patientId: 'P-10245',
        temp: 101.2,
        bpSystolic: 130,
        bpDiastolic: 85,
        pulse: 98,
        spo2: 97,
        respiratoryRate: 18,
        recordedBy: 'ASHA - Sarita Devi',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        synced: true
      },
      {
        patientId: 'P-10246',
        temp: 98.6,
        bpSystolic: 185,
        bpDiastolic: 115,
        pulse: 110,
        spo2: 92,
        respiratoryRate: 26,
        recordedBy: 'ASHA - Sarita Devi',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        synced: true
      },
      {
        patientId: 'P-10247',
        temp: 98.4,
        bpSystolic: 118,
        bpDiastolic: 76,
        pulse: 78,
        spo2: 99,
        respiratoryRate: 16,
        recordedBy: 'ASHA - Kavita Rani',
        timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
        synced: true
      }
    ];

    for (const v of mockVitals) {
      await this.add('vitals', v);
    }

    // 3. Mock Triage Records
    const mockTriage = [
      {
        patientId: 'P-10245',
        category: 'YELLOW',
        score: 4,
        redFlags: ['Fever > 101°F'],
        recommendedActions: 'Administer Paracetamol, encourage fluids, consult PHC Doctor within 24 hours.',
        disclaimer: 'Digital triage guidance only. Does not replace physician diagnosis.',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        synced: true
      },
      {
        patientId: 'P-10246',
        category: 'RED',
        score: 9,
        redFlags: ['Severe Hypertensive Crisis (BP 185/115)', 'Chest discomfort', 'High Pulse 110 bpm'],
        recommendedActions: 'EMERGENCY: Immediate referral to District Hospital / CHC. Oxygen support if available.',
        disclaimer: 'Digital triage guidance only. Does not replace physician diagnosis.',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        synced: true
      }
    ];

    for (const t of mockTriage) {
      await this.add('triage', t);
    }

    // 4. Mock Referrals
    const mockReferrals = [
      {
        patientId: 'P-10246',
        reason: 'Acute Hypertensive Crisis & Suspected Cardiac Angina',
        facility: 'Kheda Community Health Centre (CHC)',
        priority: 'EMERGENCY',
        status: 'Pending',
        notes: 'Patient requires emergency ECG, IV antihypertensives, and cardiologist review.',
        createdBy: 'ASHA - Sarita Devi',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        synced: true
      }
    ];

    for (const r of mockReferrals) {
      await this.add('referrals', r);
    }

    // 5. Mock Follow-ups
    const mockFollowups = [
      {
        patientId: 'P-10247',
        type: 'Maternal (ANC Checkup)',
        dueDate: new Date(Date.now() + 3600000 * 24 * 7).toISOString().split('T')[0],
        status: 'Pending',
        notes: '2nd Trimester Hb test and tetanus toxoid booster dose due.',
        synced: true
      },
      {
        patientId: 'P-10248',
        type: 'Child Immunization',
        dueDate: new Date(Date.now() + 3600000 * 24 * 3).toISOString().split('T')[0],
        status: 'Pending',
        notes: 'Pentavalent 3 & OPV 3 vaccination due.',
        synced: true
      }
    ];

    for (const f of mockFollowups) {
      await this.add('followups', f);
    }

    // 6. Mock Inventory & Drug Availability
    const mockInventory = [
      { id: 'INV-101', facilityId: 'PHC-RAMPUR', facilityName: 'Rampur PHC', itemName: 'Paracetamol 500mg', category: 'Essential Medicine', stockCount: 120, unit: 'Tablets', minThreshold: 200, status: 'LOW_STOCK' },
      { id: 'INV-102', facilityId: 'PHC-RAMPUR', facilityName: 'Rampur PHC', itemName: 'Amoxicillin 500mg', category: 'Antibiotics', stockCount: 450, unit: 'Capsules', minThreshold: 150, status: 'ADEQUATE' },
      { id: 'INV-103', facilityId: 'PHC-RAMPUR', facilityName: 'Rampur PHC', itemName: 'Amlodipine 5mg', category: 'Hypertension', stockCount: 80, unit: 'Tablets', minThreshold: 100, status: 'LOW_STOCK' },
      { id: 'INV-104', facilityId: 'PHC-RAMPUR', facilityName: 'Rampur PHC', itemName: 'ORS Packets', category: 'Hydration', stockCount: 300, unit: 'Sachets', minThreshold: 100, status: 'ADEQUATE' },
      { id: 'INV-105', facilityId: 'CHC-KHEDA', facilityName: 'Kheda CHC (Nearby)', itemName: 'Paracetamol 500mg', category: 'Essential Medicine', stockCount: 2400, unit: 'Tablets', minThreshold: 500, status: 'ADEQUATE' },
      { id: 'INV-106', facilityId: 'CHC-KHEDA', facilityName: 'Kheda CHC (Nearby)', itemName: 'Oxygen Cylinders (D-type)', category: 'Emergency Equipment', stockCount: 2, unit: 'Cylinders', minThreshold: 5, status: 'CRITICAL' }
    ];

    for (const item of mockInventory) {
      await this.add('inventory', item);
    }

    console.log('[IndexedDB] Mock data seeded successfully.');
  }
}

// Global Singleton Instance
const db = new GramHealthDB();
