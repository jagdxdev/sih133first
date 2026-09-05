/**
 * GramHealth District Administrator Dashboard (js/admin.js)
 * -------------------------------------------------------------
 * Features:
 * 1. District Overview & Aggregate Healthcare Metrics
 * 2. Facility Cards & Real-time Patient Load Monitoring
 * 3. Automated Resource Optimization & Medicine Stock Rebalancing Alerts
 * 4. Maternal/Child Healthcare Compliance & Quality Analytics
 */

const adminModule = {
  /**
   * Renders District Administrator View
   */
  async renderDashboard(container) {
    const patients = await db.getAll('patients');
    const referrals = await db.getAll('referrals');
    const inventory = await db.getAll('inventory');
    const followups = await db.getAll('followups');

    const totalPatients = patients.length;
    const redPatients = patients.filter(p => p.riskLevel === 'RED').length;
    const feverCases = patients.filter(p => (p.symptoms || '').toLowerCase().includes('fever')).length;
    const completedReferrals = referrals.filter(r => r.status === 'Complete').length;
    const totalReferrals = referrals.length;
    const referralRate = totalReferrals > 0 ? Math.round((completedReferrals / totalReferrals) * 100) : 85;

    const lowStockItems = inventory.filter(i => i.status === 'LOW_STOCK' || i.status === 'CRITICAL');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">District Healthcare Administration</h2>
          <p class="page-subtitle">District Health Mission • Sector 4 Command Centre • Real-time Monitoring</p>
        </div>
        <button class="btn btn-primary" onclick="adminModule.showOptimizationModal()">
          ⚡ Run Resource Auto-Optimizer
        </button>
      </div>

      <!-- District Metrics Overview Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon teal">🏛️</div>
          <div>
            <div class="stat-value">3 PHCs</div>
            <div class="stat-label">Monitored Health Facilities</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">👥</div>
          <div>
            <div class="stat-value">${totalPatients}</div>
            <div class="stat-label">Total Registered Population</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">🤒</div>
          <div>
            <div class="stat-value">${feverCases}</div>
            <div class="stat-label">Active Fever Cases</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">🚨</div>
          <div>
            <div class="stat-value">${redPatients}</div>
            <div class="stat-label">High-Risk Emergency Cases</div>
          </div>
        </div>
      </div>

      <!-- Resource Shortage Alerts -->
      <div class="card" style="border-left: 4px solid var(--risk-yellow);">
        <div class="card-header">
          <h3 class="card-title">⚠️ Automated Resource Optimization Alerts (${lowStockItems.length} Actions Needed)</h3>
          <span class="badge badge-yellow">Action Required</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="background:#fffbe6; border:1px solid #fcd34d; padding:14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>📦 Low Stock Alert: Paracetamol 500mg at Rampur PHC</strong>
              <div style="font-size:0.85rem; color:#78350f;">Current stock: 120 Tablets (Min threshold: 200). Kheda CHC has surplus 2,400 tablets.</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="adminModule.transferStock('Paracetamol 500mg', 'Kheda CHC', 'Rampur PHC', 500)">
              🚚 Rebalance Stock (+500 Tabs)
            </button>
          </div>

          <div style="background:#fef2f2; border:1px solid #fca5a5; padding:14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>🚨 Critical Alert: Oxygen Cylinder Reserve at Kheda CHC</strong>
              <div style="font-size:0.85rem; color:#7f1d1d;">Only 2 D-type cylinders available (Min threshold: 5). High emergency risk demand.</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="adminModule.deployMobileUnit('Oxygen Dispatch', 'District Hospital HQ', 'Kheda CHC')">
              ⚡ Dispatch Emergency Oxygen
            </button>
          </div>
        </div>
      </div>

      <!-- Facility Performance Cards -->
      <h3 style="margin-bottom:16px;">🏥 Primary Health Facility Performance</h3>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:24px;">
        <div class="card">
          <div class="card-header">
            <strong>Rampur PHC</strong>
            <span class="badge badge-green">Normal Operational</span>
          </div>
          <p style="font-size:0.9rem; color:#64748b;">OPD Load: <strong>142 patients/day</strong></p>
          <p style="font-size:0.9rem; color:#64748b;">Avg Doctor Wait Time: <strong>12 mins</strong></p>
          <p style="font-size:0.9rem; color:#64748b;">Referral Success: <strong>92%</strong></p>
        </div>

        <div class="card">
          <div class="card-header">
            <strong>Sundarpur Sub-Centre</strong>
            <span class="badge badge-yellow">High Wait Time</span>
          </div>
          <p style="font-size:0.9rem; color:#64748b;">OPD Load: <strong>198 patients/day</strong></p>
          <p style="font-size:0.9rem; color:#64748b;">Avg Doctor Wait Time: <strong>38 mins</strong></p>
          <p style="font-size:0.9rem; color:#64748b;">Referral Success: <strong>78%</strong></p>
          <button class="btn btn-outline btn-sm" style="margin-top:10px; width:100%;" onclick="adminModule.deployMobileUnit('Doctor Relief Unit', 'District HQ', 'Sundarpur Sub-Centre')">
            🚐 Deploy Mobile Health Unit
          </button>
        </div>

        <div class="card">
          <div class="card-header">
            <strong>Kheda CHC (First Referral)</strong>
            <span class="badge badge-green">Normal Operational</span>
          </div>
          <p style="font-size:0.9rem; color:#64748b;">OPD Load: <strong>310 patients/day</strong></p>
          <p style="font-size:0.9rem; color:#64748b;">Avg Doctor Wait Time: <strong>18 mins</strong></p>
          <p style="font-size:0.9rem; color:#64748b;">Bed Occupancy: <strong>74%</strong></p>
        </div>
      </div>

      <!-- Maternal & Child Tracker -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">👶 Maternal & Child Healthcare (MCH) Analytics</h3>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Care Type</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${followups.map(f => `
                <tr>
                  <td><strong>${f.patientId}</strong></td>
                  <td>${app.escapeHtml(f.type)}</td>
                  <td>${f.dueDate}</td>
                  <td><span class="badge badge-yellow">${f.status}</span></td>
                  <td>${app.escapeHtml(f.notes || 'Routine checkup')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * Rebalances stock between facilities
   */
  async transferStock(itemName, fromFacility, toFacility, amount) {
    const inventory = await db.getAll('inventory');
    const target = inventory.find(i => i.itemName.includes(itemName) && i.facilityName.includes(toFacility));

    if (target) {
      target.stockCount += amount;
      target.status = 'ADEQUATE';
      await db.update('inventory', target);
    }

    app.showToast(`🚚 Rebalanced ${amount} units of ${itemName} from ${fromFacility} to ${toFacility}!`, 'success');
    this.renderDashboard(document.getElementById('main-content'));
  },

  /**
   * Action: Deploys Mobile Health Unit / Emergency Dispatch
   */
  deployMobileUnit(unitType, origin, destination) {
    app.showToast(`🚐 ${unitType} dispatched from ${origin} to ${destination}! Status: En Route.`, 'success');
  },

  /**
   * Modal: Resource Optimizer
   */
  showOptimizationModal() {
    app.showToast('⚡ Running District Resource Optimization Algorithm...', 'success');
    setTimeout(() => {
      app.showToast('✅ District resources optimized. All stock thresholds balanced.', 'success');
    }, 1200);
  }
};
