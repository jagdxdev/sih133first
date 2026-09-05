/**
 * GramHealth ASHA Frontline Worker Workflow (js/asha.js)
 * -------------------------------------------------------------
 * Features:
 * 1. Home-visit Patient Registration (Auto Patient ID e.g. P-10249)
 * 2. Vitals Recorder & Real-time Digital Triage Evaluation
 * 3. Local Patient Directory Search (ID, Name, Village, Mobile)
 * 4. Referral & Maternal/Child Follow-up Logger
 */

const ashaModule = {
  /**
   * Generates next unique Patient ID string e.g. 'P-10249'
   */
  async generatePatientId() {
    const patients = await db.getAll('patients');
    const existingNums = patients
      .map(p => parseInt((p.patientId || '').replace('P-', ''), 10))
      .filter(n => !isNaN(n));
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 10248;
    return `P-${maxNum + 1}`;
  },

  /**
   * Renders the main ASHA Worker Dashboard view into container
   */
  async renderDashboard(container) {
    const patients = await db.getAll('patients');
    const followups = await db.getAll('followups');
    const referrals = await db.getAll('referrals');

    const totalCount = patients.length;
    const redCount = patients.filter(p => p.riskLevel === 'RED').length;
    const pendingFollowups = followups.filter(f => f.status === 'Pending').length;
    const pendingReferrals = referrals.filter(r => r.status === 'Pending').length;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">ASHA Field Health Portal</h2>
          <p class="page-subtitle">Rampur & Nearby Sub-Centres • Offline-First Field Workstation</p>
        </div>
        <button class="btn btn-primary" onclick="ashaModule.showRegisterModal()">
          ➕ Register New Patient
        </button>
      </div>

      <!-- Metrics Summary Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon teal">👥</div>
          <div>
            <div class="stat-value">${totalCount}</div>
            <div class="stat-label">Total Registered Patients</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">🚨</div>
          <div>
            <div class="stat-value">${redCount}</div>
            <div class="stat-label">Emergency High-Risk (RED)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">📅</div>
          <div>
            <div class="stat-value">${pendingFollowups}</div>
            <div class="stat-label">Pending Follow-ups</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">🚑</div>
          <div>
            <div class="stat-value">${pendingReferrals}</div>
            <div class="stat-label">Active Referrals</div>
          </div>
        </div>
      </div>

      <!-- Quick Search Bar & Patient Directory -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🔍 Search Patient Directory</h3>
          <span class="badge badge-sync-done">IndexedDB Offline Ready</span>
        </div>
        <div class="form-row cols-3" style="margin-bottom: 16px;">
          <input type="text" id="asha-search-input" placeholder="Search by Patient ID (e.g. P-10245), Name, Mobile..." oninput="ashaModule.handleSearch()">
          <select id="asha-village-filter" onchange="ashaModule.handleSearch()">
            <option value="">All Villages</option>
            <option value="Rampur">Rampur</option>
            <option value="Sundarpur">Sundarpur</option>
            <option value="Kheda">Kheda</option>
          </select>
          <select id="asha-risk-filter" onchange="ashaModule.handleSearch()">
            <option value="">All Triage Categories</option>
            <option value="RED">RED (Severe)</option>
            <option value="YELLOW">YELLOW (Moderate)</option>
            <option value="GREEN">GREEN (Stable)</option>
          </select>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name / Age / Gender</th>
                <th>Village</th>
                <th>Triage Risk</th>
                <th>Sync Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="asha-patient-table-body">
              <!-- Rendered dynamically -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.handleSearch();
  },

  /**
   * Filters and updates table rows based on search parameters
   */
  async handleSearch() {
    const searchInput = (document.getElementById('asha-search-input')?.value || '').toLowerCase();
    const villageFilter = document.getElementById('asha-village-filter')?.value || '';
    const riskFilter = document.getElementById('asha-risk-filter')?.value || '';

    const patients = await db.getAll('patients');

    const filtered = patients.filter(p => {
      const matchesText = !searchInput || 
        (p.patientId || '').toLowerCase().includes(searchInput) ||
        (p.name || '').toLowerCase().includes(searchInput) ||
        (p.mobile || '').includes(searchInput);

      const matchesVillage = !villageFilter || p.village === villageFilter;
      const matchesRisk = !riskFilter || p.riskLevel === riskFilter;

      return matchesText && matchesVillage && matchesRisk;
    });

    const tbody = document.getElementById('asha-patient-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: #64748b;">No matching patient records found in local offline database.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      let riskBadge = `<span class="badge badge-green">GREEN</span>`;
      if (p.riskLevel === 'RED') riskBadge = `<span class="badge badge-red">RED EMERGENCY</span>`;
      else if (p.riskLevel === 'YELLOW') riskBadge = `<span class="badge badge-yellow">YELLOW RISK</span>`;

      const syncBadge = p.synced 
        ? `<span class="badge badge-sync-done">🟢 Synced</span>`
        : `<span class="badge badge-sync-pending">🟠 Pending Sync</span>`;

      return `
        <tr>
          <td><strong>${p.patientId}</strong></td>
          <td>
            <div><strong>${app.escapeHtml(p.name)}</strong></div>
            <div style="font-size:0.8rem; color:#64748b;">${p.age} yrs • ${p.gender} • 📞 ${p.mobile || 'N/A'}</div>
          </td>
          <td>${app.escapeHtml(p.village)}</td>
          <td>${riskBadge}</td>
          <td>${syncBadge}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-primary btn-sm" onclick="ashaModule.showVitalsModal('${p.patientId}')">🩺 Vitals</button>
              <button class="btn btn-outline btn-sm" onclick="ashaModule.showReferralModal('${p.patientId}')">🚑 Refer</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Modal: New Patient Registration Form
   */
  async showRegisterModal() {
    const newId = await this.generatePatientId();
    const modalHtml = `
      <div class="modal-overlay" id="register-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">📋 Register New Patient (Home Visit)</h3>
            <button class="modal-close" onclick="app.closeModal('register-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="register-patient-form" onsubmit="ashaModule.handleRegisterSubmit(event)">
              <div class="form-row cols-2">
                <div class="form-group">
                  <label>Assigned Patient ID (Auto-Generated)</label>
                  <input type="text" id="reg-id" value="${newId}" readonly style="background:#f1f5f9; font-weight:700; color:#0d9488;">
                </div>
                <div class="form-group">
                  <label>Full Name *</label>
                  <input type="text" id="reg-name" required placeholder="e.g. Laxmi Devi">
                </div>
              </div>

              <div class="form-row cols-3">
                <div class="form-group">
                  <label>Age (Years) *</label>
                  <input type="number" id="reg-age" required min="0" max="120" placeholder="e.g. 32">
                </div>
                <div class="form-group">
                  <label>Gender *</label>
                  <select id="reg-gender" required>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Mobile Number (Optional)</label>
                  <input type="tel" id="reg-mobile" placeholder="10-digit mobile">
                </div>
              </div>

              <div class="form-row cols-2">
                <div class="form-group">
                  <label>Village / Gram Panchayat *</label>
                  <select id="reg-village" required>
                    <option value="Rampur">Rampur</option>
                    <option value="Sundarpur">Sundarpur</option>
                    <option value="Kheda">Kheda</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Emergency Contact Person & Phone *</label>
                  <input type="text" id="reg-emergency" required placeholder="e.g. Husband - 9876543210">
                </div>
              </div>

              <div class="form-group">
                <label>Main Medical Complaint & Symptoms *</label>
                <textarea id="reg-complaint" rows="2" required placeholder="Describe chief complaint (e.g. Fever, cough, nausea since 2 days)..."></textarea>
              </div>

              <div class="form-row cols-3">
                <div class="form-group">
                  <label>Pre-existing Conditions</label>
                  <input type="text" id="reg-diseases" placeholder="e.g. Hypertension, Diabetes">
                </div>
                <div class="form-group">
                  <label>Current Medicines</label>
                  <input type="text" id="reg-medicines" placeholder="e.g. Paracetamol, Metformin">
                </div>
                <div class="form-group">
                  <label>Known Allergies</label>
                  <input type="text" id="reg-allergies" placeholder="e.g. Penicillin, Sulfa">
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="app.closeModal('register-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">💾 Save Patient Record</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    app.openModalRaw(modalHtml);
  },

  /**
   * Handles submission of registration form
   */
  async handleRegisterSubmit(event) {
    event.preventDefault();

    const patientObj = {
      patientId: document.getElementById('reg-id').value,
      name: document.getElementById('reg-name').value.trim(),
      age: parseInt(document.getElementById('reg-age').value, 10),
      gender: document.getElementById('reg-gender').value,
      mobile: document.getElementById('reg-mobile').value.trim(),
      village: document.getElementById('reg-village').value,
      emergencyContact: document.getElementById('reg-emergency').value.trim(),
      complaint: document.getElementById('reg-complaint').value.trim(),
      symptoms: document.getElementById('reg-complaint').value.trim(),
      diseases: document.getElementById('reg-diseases').value.trim() || 'None',
      medicines: document.getElementById('reg-medicines').value.trim() || 'None',
      allergies: document.getElementById('reg-allergies').value.trim() || 'None',
      riskLevel: 'GREEN',
      createdAt: new Date().toISOString(),
      synced: false
    };

    // Save to IndexedDB
    await db.add('patients', patientObj);

    // Push to Sync Queue
    await syncEngine.enqueue('CREATE_PATIENT', 'patients', patientObj);

    app.closeModal('register-modal');
    app.showToast(`✅ Patient ${patientObj.name} (${patientObj.patientId}) registered offline!`, 'success');
    this.renderDashboard(document.getElementById('main-content'));
  },

  /**
   * Modal: Vitals Recorder & Live Digital Triage Evaluator
   */
  async showVitalsModal(patientId) {
    const patient = await db.getById('patients', patientId);
    if (!patient) return;

    const modalHtml = `
      <div class="modal-overlay" id="vitals-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">🩺 Record Vitals & Digital Triage — ${app.escapeHtml(patient.name)} (${patient.patientId})</h3>
            <button class="modal-close" onclick="app.closeModal('vitals-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="vitals-form" onsubmit="ashaModule.handleVitalsSubmit(event, '${patient.patientId}')">
              <div class="form-row cols-3">
                <div class="form-group">
                  <label>Body Temp (°F) *</label>
                  <input type="number" step="0.1" id="vit-temp" value="98.6" required oninput="ashaModule.recalculateLiveTriage()">
                </div>
                <div class="form-group">
                  <label>BP Systolic (mmHg) *</label>
                  <input type="number" id="vit-bpsys" value="120" required oninput="ashaModule.recalculateLiveTriage()">
                </div>
                <div class="form-group">
                  <label>BP Diastolic (mmHg) *</label>
                  <input type="number" id="vit-bpdia" value="80" required oninput="ashaModule.recalculateLiveTriage()">
                </div>
              </div>

              <div class="form-row cols-3">
                <div class="form-group">
                  <label>Pulse Rate (bpm) *</label>
                  <input type="number" id="vit-pulse" value="72" required oninput="ashaModule.recalculateLiveTriage()">
                </div>
                <div class="form-group">
                  <label>SpO2 Saturation (%)</label>
                  <input type="number" id="vit-spo2" value="98" min="50" max="100" oninput="ashaModule.recalculateLiveTriage()">
                </div>
                <div class="form-group">
                  <label>Respiratory Rate (/min)</label>
                  <input type="number" id="vit-resp" value="16" min="5" max="60" oninput="ashaModule.recalculateLiveTriage()">
                </div>
              </div>

              <div class="form-group">
                <label>Observed Red Flag Symptoms (Select all that apply)</label>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:0.85rem;">
                  <label><input type="checkbox" class="symptom-check" value="Severe Breathlessness" onchange="ashaModule.recalculateLiveTriage()"> Chest Pain / Shortness of Breath</label>
                  <label><input type="checkbox" class="symptom-check" value="High Fever" onchange="ashaModule.recalculateLiveTriage()"> Persistent High Fever > 2 days</label>
                  <label><input type="checkbox" class="symptom-check" value="Loss of Consciousness" onchange="ashaModule.recalculateLiveTriage()"> Dizziness / Loss of Consciousness</label>
                  <label><input type="checkbox" class="symptom-check" value="Convulsions" onchange="ashaModule.recalculateLiveTriage()"> Convulsions / Seizures</label>
                </div>
              </div>

              <!-- Live Triage Score Container -->
              <div id="live-triage-output"></div>

              <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="app.closeModal('vitals-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">💾 Save Vitals & Triage</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    app.openModalRaw(modalHtml);
    this.recalculateLiveTriage();
  },

  /**
   * Recalculates live triage calculation on input change
   */
  recalculateLiveTriage() {
    const temp = parseFloat(document.getElementById('vit-temp')?.value);
    const bpSys = parseInt(document.getElementById('vit-bpsys')?.value, 10);
    const bpDia = parseInt(document.getElementById('vit-bpdia')?.value, 10);
    const pulse = parseInt(document.getElementById('vit-pulse')?.value, 10);
    const spo2 = parseInt(document.getElementById('vit-spo2')?.value, 10);
    const resp = parseInt(document.getElementById('vit-resp')?.value, 10);

    const checkedBoxes = Array.from(document.querySelectorAll('.symptom-check:checked')).map(cb => cb.value);

    // Validate physiological range
    const validation = triageEngine.validateVitalsInput(temp, bpSys, bpDia, pulse);
    const container = document.getElementById('live-triage-output');
    if (!container) return;

    if (!validation.isValid) {
      container.innerHTML = `
        <div style="background:#fee2e2; color:#dc2626; padding:12px; border-radius:6px; font-size:0.85rem; margin-top:12px;">
          ⚠️ ${validation.errors.join(' • ')}
        </div>
      `;
      return;
    }

    const triage = triageEngine.evaluate(
      { temp, bpSystolic: bpSys, bpDiastolic: bpDia, pulse, spo2, respiratoryRate: resp },
      checkedBoxes
    );

    let borderClass = 'GREEN';
    if (triage.category === 'RED') borderClass = 'RED';
    else if (triage.category === 'YELLOW') borderClass = 'YELLOW';

    container.innerHTML = `
      <div class="triage-result-banner ${borderClass}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:1.1rem;">Digital Triage Result: ${triage.category}</strong>
          <span class="badge badge-${triage.category.toLowerCase()}">Risk Score: ${triage.score}</span>
        </div>
        <p>${triage.recommendedActions}</p>
        ${triage.redFlags.length > 0 ? `<div style="font-size:0.85rem; font-weight:600;">🚨 Red Flags: ${triage.redFlags.join(', ')}</div>` : ''}
        <div class="medical-disclaimer">${triage.disclaimer}</div>
      </div>
    `;
  },

  /**
   * Handles vitals form submission
   */
  async handleVitalsSubmit(event, patientId) {
    event.preventDefault();

    const temp = parseFloat(document.getElementById('vit-temp').value);
    const bpSys = parseInt(document.getElementById('vit-bpsys').value, 10);
    const bpDia = parseInt(document.getElementById('vit-bpdia').value, 10);
    const pulse = parseInt(document.getElementById('vit-pulse').value, 10);
    const spo2 = parseInt(document.getElementById('vit-spo2').value, 10);
    const resp = parseInt(document.getElementById('vit-resp').value, 10);

    const checkedBoxes = Array.from(document.querySelectorAll('.symptom-check:checked')).map(cb => cb.value);

    const triage = triageEngine.evaluate(
      { temp, bpSystolic: bpSys, bpDiastolic: bpDia, pulse, spo2, respiratoryRate: resp },
      checkedBoxes
    );

    const vitalsRecord = {
      patientId: patientId,
      temp: temp,
      bpSystolic: bpSys,
      bpDiastolic: bpDia,
      pulse: pulse,
      spo2: spo2,
      respiratoryRate: resp,
      recordedBy: auth.getCurrentUser()?.name || 'ASHA Worker',
      timestamp: new Date().toISOString(),
      synced: false
    };

    const triageRecord = {
      patientId: patientId,
      category: triage.category,
      score: triage.score,
      redFlags: triage.redFlags,
      recommendedActions: triage.recommendedActions,
      disclaimer: triage.disclaimer,
      timestamp: new Date().toISOString(),
      synced: false
    };

    // Save vitals & triage to IndexedDB
    await db.add('vitals', vitalsRecord);
    await db.add('triage', triageRecord);

    // Update patient risk category
    const patient = await db.getById('patients', patientId);
    if (patient) {
      patient.riskLevel = triage.category;
      patient.synced = false;
      await db.update('patients', patient);
    }

    // Queue for sync
    await syncEngine.enqueue('RECORD_VITALS', 'vitals', vitalsRecord);
    await syncEngine.enqueue('RECORD_TRIAGE', 'triage', triageRecord);

    app.closeModal('vitals-modal');
    app.showToast(`✅ Vitals recorded. Patient Risk Level: ${triage.category}`, triage.category === 'RED' ? 'danger' : 'success');
    this.renderDashboard(document.getElementById('main-content'));
  },

  /**
   * Modal: Create Referral to CHC or District Hospital
   */
  async showReferralModal(patientId) {
    const patient = await db.getById('patients', patientId);
    if (!patient) return;

    const modalHtml = `
      <div class="modal-overlay" id="referral-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">🚑 Issue Emergency / CHC Referral — ${app.escapeHtml(patient.name)}</h3>
            <button class="modal-close" onclick="app.closeModal('referral-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="referral-form" onsubmit="ashaModule.handleReferralSubmit(event, '${patient.patientId}')">
              <div class="form-group">
                <label>Destination Facility *</label>
                <select id="ref-facility" required>
                  <option value="Kheda Community Health Centre (CHC)">Kheda Community Health Centre (CHC)</option>
                  <option value="District Civil Hospital (Sector 4)">District Civil Hospital (Sector 4)</option>
                  <option value="Rampur Primary Health Centre (PHC)">Rampur Primary Health Centre (PHC)</option>
                </select>
              </div>

              <div class="form-group">
                <label>Priority Level *</label>
                <select id="ref-priority" required>
                  <option value="EMERGENCY">EMERGENCY (Immediate Transfer)</option>
                  <option value="URGENT">URGENT (Within 24 Hours)</option>
                  <option value="ROUTINE">ROUTINE Consult</option>
                </select>
              </div>

              <div class="form-group">
                <label>Reason for Referral & Clinical Notes *</label>
                <textarea id="ref-reason" rows="3" required placeholder="Specify symptoms, red flag vitals, or required specialized equipment/doctor..."></textarea>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="app.closeModal('referral-modal')">Cancel</button>
                <button type="submit" class="btn btn-danger">🚨 Issue Referral Ticket</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    app.openModalRaw(modalHtml);
  },

  /**
   * Handles referral submission
   */
  async handleReferralSubmit(event, patientId) {
    event.preventDefault();

    const referralObj = {
      patientId: patientId,
      facility: document.getElementById('ref-facility').value,
      priority: document.getElementById('ref-priority').value,
      reason: document.getElementById('ref-reason').value.trim(),
      status: 'Pending',
      createdBy: auth.getCurrentUser()?.name || 'ASHA Worker',
      timestamp: new Date().toISOString(),
      synced: false
    };

    await db.add('referrals', referralObj);
    await syncEngine.enqueue('CREATE_REFERRAL', 'referrals', referralObj);

    app.closeModal('referral-modal');
    app.showToast(`🚑 Referral ticket created for ${patientId}`, 'success');
    this.renderDashboard(document.getElementById('main-content'));
  }
};
