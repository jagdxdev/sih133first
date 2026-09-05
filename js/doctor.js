/**
 * GramHealth PHC Doctor Dashboard & Consultation Workstation (js/doctor.js)
 * -------------------------------------------------------------
 * Features:
 * 1. PHC Doctor Overview (Waiting Queue, Red Emergency Alerts, Pending Referrals)
 * 2. Longitudinal Health History (Chronological timeline of past visits & vitals)
 * 3. Clinical Consultation & Electronic Prescription (Rx Generator)
 * 4. Assisted Specialist Teleconsultation Builder
 * 5. Diagnostic & Medicine Stock Availability Checker (PHC vs CHC stock)
 */

const doctorModule = {
  /**
   * Renders PHC Doctor Main Workstation View
   */
  async renderDashboard(container) {
    const patients = await db.getAll('patients');
    const referrals = await db.getAll('referrals');
    const vitalsList = await db.getAll('vitals');
    const inventory = await db.getAll('inventory');

    const redPatients = patients.filter(p => p.riskLevel === 'RED');
    const pendingReferrals = referrals.filter(r => r.status === 'Pending');
    const lowStockItems = inventory.filter(i => i.status === 'LOW_STOCK' || i.status === 'CRITICAL');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">PHC Doctor Clinical Workstation</h2>
          <p class="page-subtitle">Rampur Primary Health Centre • Outpatient Consultation & Longitudinal History</p>
        </div>
        <button class="btn btn-secondary" onclick="doctorModule.showStockModal()">
          💊 Check Pharmacy Stock & Facilities
        </button>
      </div>

      <!-- Doctor Stats Metrics -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon teal">🩺</div>
          <div>
            <div class="stat-value">${patients.length}</div>
            <div class="stat-label">Active OPD Patients</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">🚨</div>
          <div>
            <div class="stat-value">${redPatients.length}</div>
            <div class="stat-label">Emergency High-Risk Alerts</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">📋</div>
          <div>
            <div class="stat-value">${pendingReferrals.length}</div>
            <div class="stat-label">Pending Inbound Referrals</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">⚠️</div>
          <div>
            <div class="stat-value">${lowStockItems.length}</div>
            <div class="stat-label">Pharmacy Low-Stock Alerts</div>
          </div>
        </div>
      </div>

      <!-- OPD Patient Queue Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">👨‍⚕️ Today's Outpatient Queue & Consultation</h3>
          <span class="badge badge-sync-done">IndexedDB Offline Ready</span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Patient Name</th>
                <th>Age / Gender / Village</th>
                <th>Emergency / Medical Complaint</th>
                <th>Triage Risk</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${patients.map(p => {
                let badge = `<span class="badge badge-green">GREEN</span>`;
                if (p.riskLevel === 'RED') badge = `<span class="badge badge-red">RED EMERGENCY</span>`;
                else if (p.riskLevel === 'YELLOW') badge = `<span class="badge badge-yellow">YELLOW RISK</span>`;

                return `
                  <tr>
                    <td><strong>${p.patientId}</strong></td>
                    <td><strong>${app.escapeHtml(p.name)}</strong></td>
                    <td>${p.age} yrs • ${p.gender} • ${app.escapeHtml(p.village)}</td>
                    <td>${app.escapeHtml(p.complaint || 'Routine Examination')}</td>
                    <td>${badge}</td>
                    <td>
                      <div style="display:flex; gap:6px;">
                        <button class="btn btn-primary btn-sm" onclick="doctorModule.showLongitudinalModal('${p.patientId}')">📜 History & Timeline</button>
                        <button class="btn btn-secondary btn-sm" onclick="doctorModule.showConsultationModal('${p.patientId}')">✍️ Consult & Rx</button>
                        <button class="btn btn-outline btn-sm" onclick="doctorModule.showTeleconsultModal('${p.patientId}')">🌐 Teleconsult</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * Modal: Longitudinal Patient Health History (Vertical Chronological Timeline)
   */
  async showLongitudinalModal(patientId) {
    const patient = await db.getById('patients', patientId);
    if (!patient) return;

    const allVitals = await db.getByIndex('vitals', 'patientId', patientId);
    const allTriage = await db.getByIndex('triage', 'patientId', patientId);
    const allReferrals = await db.getByIndex('referrals', 'patientId', patientId);

    // Merge and sort timeline events by timestamp descending
    const events = [];

    allVitals.forEach(v => {
      events.push({
        type: 'VITALS',
        title: '🩺 Vitals & Field Observation',
        date: new Date(v.timestamp).toLocaleString(),
        timestamp: new Date(v.timestamp).getTime(),
        author: v.recordedBy || 'ASHA Worker',
        details: `Temp: ${v.temp}°F • BP: ${v.bpSystolic}/${v.bpDiastolic} mmHg • Pulse: ${v.pulse} bpm • SpO2: ${v.spo2}%`
      });
    });

    allTriage.forEach(t => {
      events.push({
        type: 'TRIAGE',
        title: `🚨 Digital Triage Evaluation (${t.category})`,
        date: new Date(t.timestamp).toLocaleString(),
        timestamp: new Date(t.timestamp).getTime(),
        author: 'GramHealth Triage Algorithm',
        details: `Risk Score: ${t.score} • Action: ${t.recommendedActions} ${t.redFlags?.length ? '• Red Flags: ' + t.redFlags.join(', ') : ''}`
      });
    });

    allReferrals.forEach(r => {
      events.push({
        type: 'REFERRAL',
        title: `🚑 Facility Referral Ticket (${r.priority})`,
        date: new Date(r.timestamp).toLocaleString(),
        timestamp: new Date(r.timestamp).getTime(),
        author: r.createdBy || 'Healthcare Worker',
        details: `Destination: ${r.facility} • Reason: ${r.reason} • Status: ${r.status}`
      });
    });

    // Add baseline registration event
    events.push({
      type: 'REGISTRATION',
      title: '📋 Patient Registration & Baseline History',
      date: new Date(patient.createdAt).toLocaleString(),
      timestamp: new Date(patient.createdAt).getTime(),
      author: 'ASHA Home Visit',
      details: `Chief Complaint: ${patient.complaint} • Existing Diseases: ${patient.diseases} • Current Meds: ${patient.medicines} • Allergies: ${patient.allergies}`
    });

    events.sort((a, b) => b.timestamp - a.timestamp);

    const modalHtml = `
      <div class="modal-overlay" id="history-modal">
        <div class="modal-content" style="max-width:760px;">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">📜 Longitudinal Health History — ${app.escapeHtml(patient.name)}</h3>
              <p style="font-size:0.85rem; color:#64748b;">ID: ${patient.patientId} • ${patient.age} yrs • ${patient.gender} • Village: ${patient.village} • Contact: ${patient.emergencyContact}</p>
            </div>
            <button class="modal-close" onclick="app.closeModal('history-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <!-- Patient Banner Card -->
            <div style="background:#f1f5f9; padding:12px 16px; border-radius:8px; margin-bottom:20px; font-size:0.9rem;">
              <div><strong>Allergies:</strong> <span style="color:#dc2626; font-weight:700;">${app.escapeHtml(patient.allergies)}</span></div>
              <div><strong>Chronic Diseases:</strong> ${app.escapeHtml(patient.diseases)}</div>
              <div><strong>Current Medication:</strong> ${app.escapeHtml(patient.medicines)}</div>
            </div>

            <h4 style="margin-bottom:12px;">Chronological Care Timeline</h4>
            <div class="timeline">
              ${events.map(ev => `
                <div class="timeline-item">
                  <div class="timeline-marker"></div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <strong>${ev.title}</strong>
                      <span>${ev.date}</span>
                    </div>
                    <p style="font-size:0.9rem; color:#334155; margin-bottom:6px;">${ev.details}</p>
                    <div style="font-size:0.75rem; color:#64748b;">By: ${ev.author}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="app.closeModal('history-modal')">Close</button>
            <button class="btn btn-primary" onclick="app.closeModal('history-modal'); doctorModule.showConsultationModal('${patient.patientId}');">✍️ Proceed to Consultation</button>
          </div>
        </div>
      </div>
    `;

    app.openModalRaw(modalHtml);
  },

  /**
   * Modal: Doctor Consultation & Prescription Generator
   */
  async showConsultationModal(patientId) {
    const patient = await db.getById('patients', patientId);
    if (!patient) return;

    const modalHtml = `
      <div class="modal-overlay" id="consult-modal">
        <div class="modal-content" style="max-width:760px;">
          <div class="modal-header">
            <h3 class="modal-title">✍️ Doctor Consultation & Prescription — ${app.escapeHtml(patient.name)} (${patient.patientId})</h3>
            <button class="modal-close" onclick="app.closeModal('consult-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <form id="consult-form" onsubmit="doctorModule.handleConsultSubmit(event, '${patient.patientId}')">
              <div class="form-group">
                <label>Clinical Observations & Diagnosis *</label>
                <textarea id="doc-diagnosis" rows="2" required placeholder="Enter clinical diagnosis (e.g. Acute Upper Respiratory Tract Infection / Essential Hypertension)..."></textarea>
              </div>

              <div class="form-group">
                <label>Prescribed Medicines (Drug Name, Dose, Frequency, Duration) *</label>
                <textarea id="doc-prescription" rows="3" required placeholder="e.g. 
1. Tab Paracetamol 500mg - 1 tablet 3 times a day for 3 days
2. Tab Amoxicillin 500mg - 1 capsule twice daily for 5 days
3. ORS Sachet - 1 packet in 1L water as needed"></textarea>
              </div>

              <div class="form-row cols-2">
                <div class="form-group">
                  <label>Dietary & Lifestyle Advice</label>
                  <input type="text" id="doc-advice" placeholder="e.g. Plenty of oral fluids, bed rest for 2 days">
                </div>
                <div class="form-group">
                  <label>Follow-up Date</label>
                  <input type="date" id="doc-followup">
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="app.closeModal('consult-modal')">Cancel</button>
                <button type="submit" class="btn btn-primary">💾 Issue Electronic Prescription</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    app.openModalRaw(modalHtml);
  },

  /**
   * Handles Consultation form submission
   */
  async handleConsultSubmit(event, patientId) {
    event.preventDefault();

    const diagnosis = document.getElementById('doc-diagnosis').value.trim();
    const prescription = document.getElementById('doc-prescription').value.trim();
    const advice = document.getElementById('doc-advice').value.trim();
    const followupDate = document.getElementById('doc-followup').value;

    const consultRecord = {
      patientId: patientId,
      diagnosis: diagnosis,
      prescription: prescription,
      advice: advice,
      doctorName: auth.getCurrentUser()?.name || 'PHC Doctor',
      timestamp: new Date().toISOString(),
      synced: false
    };

    // If follow-up date specified, log follow-up item
    if (followupDate) {
      await db.add('followups', {
        patientId: patientId,
        type: 'Doctor Follow-up',
        dueDate: followupDate,
        status: 'Pending',
        notes: `Post-consultation follow-up for: ${diagnosis}`,
        synced: false
      });
    }

    await syncEngine.enqueue('RECORD_CONSULTATION', 'vitals', consultRecord);

    app.closeModal('consult-modal');
    app.showToast(`✅ Consultation & Prescription recorded for ${patientId}`, 'success');
    this.renderDashboard(document.getElementById('main-content'));
  },

  /**
   * Modal: Assisted Teleconsultation Builder
   */
  async showTeleconsultModal(patientId) {
    const patient = await db.getById('patients', patientId);
    if (!patient) return;

    const modalHtml = `
      <div class="modal-overlay" id="tele-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">🌐 Initiate Assisted Specialist Teleconsultation</h3>
            <button class="modal-close" onclick="app.closeModal('tele-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <p style="font-size:0.9rem; color:#64748b; margin-bottom:16px;">
              Request remote teleconsultation review from District Hospital Specialists for <strong>${app.escapeHtml(patient.name)} (${patient.patientId})</strong>.
            </p>

            <div class="form-group">
              <label>Specialty Required *</label>
              <select id="tele-specialty">
                <option value="Cardiology">Cardiology (Heart Specialist)</option>
                <option value="Pediatrics">Pediatrics (Child Specialist)</option>
                <option value="Obstetrics & Gynecology">Obstetrics & Gynecology (Maternal)</option>
                <option value="General Medicine">General Internal Medicine</option>
              </select>
            </div>

            <div class="form-group">
              <label>Clinical Case Summary & Teleconsult Notes *</label>
              <textarea id="tele-summary" rows="3" placeholder="Provide patient history summary, vital trends, and specific questions for the specialist..."></textarea>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-outline" onclick="app.closeModal('tele-modal')">Cancel</button>
              <button type="button" class="btn btn-secondary" onclick="doctorModule.handleTeleSubmit('${patient.patientId}')">📡 Dispatch Teleconsult Request</button>
            </div>
          </div>
        </div>
      </div>
    `;

    app.openModalRaw(modalHtml);
  },

  handleTeleSubmit(patientId) {
    app.closeModal('tele-modal');
    app.showToast(`🌐 Teleconsultation request sent to District Hospital Specialist for ${patientId}!`, 'success');
  },

  /**
   * Modal: Medicine Stock & Diagnostic Availability
   */
  async showStockModal() {
    const inventory = await db.getAll('inventory');

    const modalHtml = `
      <div class="modal-overlay" id="stock-modal">
        <div class="modal-content" style="max-width:760px;">
          <div class="modal-header">
            <h3 class="modal-title">💊 Medicine Stock & Facility Diagnostic Checker</h3>
            <button class="modal-close" onclick="app.closeModal('stock-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Facility</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Available Stock</th>
                    <th>Status Alert</th>
                  </tr>
                </thead>
                <tbody>
                  ${inventory.map(item => {
                    let badge = `<span class="badge badge-green">ADEQUATE</span>`;
                    if (item.status === 'LOW_STOCK') badge = `<span class="badge badge-yellow">LOW STOCK</span>`;
                    else if (item.status === 'CRITICAL') badge = `<span class="badge badge-red">CRITICAL SHORTAGE</span>`;

                    return `
                      <tr>
                        <td><strong>${app.escapeHtml(item.facilityName)}</strong></td>
                        <td>${app.escapeHtml(item.itemName)}</td>
                        <td>${app.escapeHtml(item.category)}</td>
                        <td><strong>${item.stockCount} ${item.unit}</strong> (Min: ${item.minThreshold})</td>
                        <td>${badge}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="app.closeModal('stock-modal')">Close</button>
          </div>
        </div>
      </div>
    `;

    app.openModalRaw(modalHtml);
  }
};
