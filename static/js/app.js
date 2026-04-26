'use strict';

// ── API client ────────────────────────────────────────────────────────────────

const api = {
  async request(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Request failed');
    }
    return res.status === 204 ? null : res.json();
  },
  get:  (p)    => api.request('GET',    p),
  post: (p, b) => api.request('POST',   p, b),
  put:  (p, b) => api.request('PUT',    p, b),
  del:  (p)    => api.request('DELETE', p),
};

// ── Charts registry ───────────────────────────────────────────────────────────

let charts = [];

function destroyCharts() {
  charts.forEach(c => c.destroy());
  charts = [];
}

function mkChart(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  charts.push(new Chart(el, config));
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function toast(msg, type = 'success') {
  const colors = { success: '#16a34a', error: '#dc2626', info: '#2563eb' };
  const el = document.createElement('div');
  el.className = 'toast-in pointer-events-auto';
  el.style.cssText = `background:${colors[type]||colors.success};color:#fff;padding:10px 16px;border-radius:8px;font-size:0.875rem;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:320px;`;
  el.textContent = msg;
  const c = document.getElementById('toast-container');
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_META = {
  monitor_at_home:  { label: 'Monitor at Home',    cls: 'bg-green-100 text-green-700'  },
  visit_clinic:     { label: 'Visit Clinic',        cls: 'bg-blue-100 text-blue-700'    },
  go_to_er:         { label: 'Go to ER',            cls: 'bg-red-100 text-red-700'      },
  schedule_followup:{ label: 'Schedule Follow-up',  cls: 'bg-purple-100 text-purple-700'},
};

const CAT_COLORS = {
  general:         'bg-gray-100 text-gray-600',
  respiratory:     'bg-sky-100 text-sky-700',
  cardiac:         'bg-red-100 text-red-600',
  neurological:    'bg-violet-100 text-violet-700',
  gastrointestinal:'bg-amber-100 text-amber-700',
  musculoskeletal: 'bg-orange-100 text-orange-700',
  dermatological:  'bg-pink-100 text-pink-600',
};

function severityBadge(n) {
  const cls = n >= 8 ? 'bg-red-100 text-red-700' : n >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
  return `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${cls}">${n}/10</span>`;
}

function actionBadge(action) {
  const m = ACTION_META[action] || { label: action, cls: 'bg-gray-100 text-gray-600' };
  return `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${m.cls}">${m.label}</span>`;
}

function catBadge(cat) {
  const cls = CAT_COLORS[cat] || 'bg-gray-100 text-gray-600';
  return `<span class="text-xs px-2 py-0.5 rounded-full ${cls}">${cat || '—'}</span>`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function avatar(name) {
  return name.trim().charAt(0).toUpperCase();
}

function setContent(html) {
  destroyCharts();
  document.getElementById('app').innerHTML = html;
}

function setTitle(t) { document.getElementById('page-title').textContent = t; }
function setActions(html) { document.getElementById('header-actions').innerHTML = html; }

function loading() {
  setContent('<div class="flex items-center justify-center py-24 text-gray-400 text-sm">Loading…</div>');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function renderDashboard() {
  setTitle('Dashboard');
  setActions('');
  loading();

  const [stats, patients] = await Promise.all([api.get('/stats'), api.get('/patients')]);
  const recent = [...patients]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  setContent(`
    <div class="space-y-6">

      <!-- Stat cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${statCard('Total Patients',      stats.total_patients,          '#2563eb', iconPeople)}
        ${statCard('Symptom Reports',     stats.total_patient_symptoms,  '#0891b2', iconClip)}
        ${statCard('Assessments',         stats.total_assessments,       '#7c3aed', iconDoc)}
        ${statCard('Symptom Types',       stats.total_symptoms,          '#d97706', iconTag)}
      </div>

      <!-- Charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div class="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <p class="text-sm font-semibold text-gray-900 mb-4">Assessments by Action</p>
          <canvas id="ch-action" height="220"></canvas>
        </div>
        <div class="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
          <p class="text-sm font-semibold text-gray-900 mb-4">Symptoms by Category</p>
          <canvas id="ch-category" height="220"></canvas>
        </div>
      </div>

      <!-- Recent patients -->
      <div class="bg-white rounded-xl border border-gray-200">
        <div class="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p class="text-sm font-semibold text-gray-900">Recent Patients</p>
          <a href="#patients" class="text-xs text-blue-600 hover:underline">View all →</a>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <th class="text-left px-5 py-3">Name</th>
              <th class="text-left px-5 py-3">Age</th>
              <th class="text-left px-5 py-3">Gender</th>
              <th class="text-left px-5 py-3">Registered</th>
            </tr>
          </thead>
          <tbody>
            ${recent.map(p => `
              <tr class="border-b border-gray-50 cursor-pointer" onclick="navigate('#patient/${p.id}')">
                <td class="px-5 py-3 font-medium text-gray-900 flex items-center gap-2">
                  <span class="w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">${avatar(p.name)}</span>
                  ${p.name}
                </td>
                <td class="px-5 py-3 text-gray-500">${p.age}</td>
                <td class="px-5 py-3 text-gray-500 capitalize">${p.gender}</td>
                <td class="px-5 py-3 text-gray-500">${fmtDate(p.created_at)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

    </div>`);

  // Doughnut — assessments by action
  const aData = stats.assessments_by_action || {};
  mkChart('ch-action', {
    type: 'doughnut',
    data: {
      labels: Object.keys(aData).map(k => ACTION_META[k]?.label || k),
      datasets: [{ data: Object.values(aData), backgroundColor: ['#16a34a','#2563eb','#dc2626','#7c3aed'], borderWidth: 0 }],
    },
    options: { cutout: '68%', plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } } } },
  });

  // Bar — symptoms by category
  const cData = stats.symptoms_by_category || {};
  mkChart('ch-category', {
    type: 'bar',
    data: {
      labels: Object.keys(cData),
      datasets: [{ label: 'Types', data: Object.values(cData), backgroundColor: '#3b82f6', borderRadius: 6 }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } },
    },
  });
}

function statCard(label, value, color, icon) {
  return `
    <div class="bg-white rounded-xl border border-gray-200 p-5">
      <div class="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style="background:${color}18">
        <span style="color:${color}">${icon}</span>
      </div>
      <p class="text-2xl font-bold text-gray-900">${Number(value).toLocaleString()}</p>
      <p class="text-xs text-gray-500 mt-1">${label}</p>
    </div>`;
}

const iconPeople = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
const iconClip  = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`;
const iconDoc   = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;
const iconTag   = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>`;

// ── Patients ──────────────────────────────────────────────────────────────────

let _patients = [];

async function renderPatients() {
  setTitle('Patients');
  setActions(`<button class="btn-primary" onclick="showAddPatientModal()">+ Add Patient</button>`);
  loading();
  _patients = await api.get('/patients');
  renderPatientTable(_patients);
}

function renderPatientTable(list) {
  setContent(`
    <div class="bg-white rounded-xl border border-gray-200">
      <div class="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
        <input id="pt-search" type="text" placeholder="Search name or email…"
               oninput="filterPatients(this.value)"
               class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <span class="text-xs text-gray-400">${list.length} patients</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <th class="text-left px-5 py-3">Name</th>
              <th class="text-left px-5 py-3">Age</th>
              <th class="text-left px-5 py-3">Gender</th>
              <th class="text-left px-5 py-3">Email</th>
              <th class="text-left px-5 py-3">Registered</th>
              <th class="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody id="pt-tbody">${ptRows(list)}</tbody>
        </table>
      </div>
    </div>`);
}

function ptRows(list) {
  if (!list.length) return `<tr><td colspan="6" class="px-5 py-12 text-center text-gray-400 text-sm">No patients found</td></tr>`;
  return list.map(p => `
    <tr class="border-b border-gray-50">
      <td class="px-5 py-3">
        <a href="#patient/${p.id}" class="flex items-center gap-2 font-medium text-gray-900 hover:text-blue-600">
          <span class="w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">${avatar(p.name)}</span>
          ${p.name}
        </a>
      </td>
      <td class="px-5 py-3 text-gray-500">${p.age}</td>
      <td class="px-5 py-3 text-gray-500 capitalize">${p.gender}</td>
      <td class="px-5 py-3 text-gray-500">${p.contact_email}</td>
      <td class="px-5 py-3 text-gray-500">${fmtDate(p.created_at)}</td>
      <td class="px-5 py-3 text-right">
        <button onclick="deletePatient(${p.id},'${p.name.replace(/'/g, "\\'")}')"
                class="text-gray-300 hover:text-red-500 transition-colors" title="Delete">
          ${iconTrash}
        </button>
      </td>
    </tr>`).join('');
}

function filterPatients(q) {
  const lq = q.toLowerCase();
  const filtered = _patients.filter(p =>
    p.name.toLowerCase().includes(lq) || p.contact_email.toLowerCase().includes(lq)
  );
  document.getElementById('pt-tbody').innerHTML = ptRows(filtered);
}

function showAddPatientModal() {
  openModal('Add Patient', `
    <form id="f-add-pt" class="space-y-4">
      <div>
        <label class="label">Full Name</label>
        <input name="name" required class="input" placeholder="Ravi Kumar"/>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Age</label>
          <input name="age" type="number" min="0" max="150" required class="input" placeholder="30"/>
        </div>
        <div>
          <label class="label">Gender</label>
          <select name="gender" required class="input">
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label class="label">Email</label>
        <input name="contact_email" type="email" required class="input" placeholder="ravi@example.com"/>
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button type="button" onclick="closeModal()" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Add Patient</button>
      </div>
    </form>`);

  document.getElementById('f-add-pt').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/patients/', {
        name: fd.get('name'), age: +fd.get('age'),
        gender: fd.get('gender'), contact_email: fd.get('contact_email'),
      });
      closeModal(); toast('Patient added');
      renderPatients();
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function deletePatient(id, name) {
  if (!confirm(`Delete "${name}"? This removes all their symptoms and assessments.`)) return;
  try {
    await api.del(`/patients/${id}`);
    toast('Patient deleted');
    renderPatients();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Patient Detail ────────────────────────────────────────────────────────────

let _allSymptoms = [];

async function renderPatientDetail(id) {
  setTitle('…');
  setActions(`<a href="#patients" class="btn-secondary">← Patients</a>`);
  loading();

  try {
    const [patient, ptSyms, assessments, allSyms] = await Promise.all([
      api.get(`/patients/${id}`),
      api.get(`/patients/${id}/symptoms`),
      api.get(`/patients/${id}/assessments`),
      api.get('/symptoms'),
    ]);
    _allSymptoms = allSyms;
    setTitle(patient.name);

    setContent(`
      <div class="space-y-5">

        <!-- Info card -->
        <div class="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-blue-100 text-blue-600 text-2xl font-bold flex items-center justify-center shrink-0">
            ${avatar(patient.name)}
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-lg font-semibold text-gray-900">${patient.name}</h2>
            <p class="text-sm text-gray-500 truncate">${patient.contact_email}</p>
            <div class="flex flex-wrap items-center gap-2 mt-1.5">
              <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">${patient.gender}</span>
              <span class="text-xs text-gray-400">Age ${patient.age}</span>
              <span class="text-xs text-gray-400">Registered ${fmtDate(patient.created_at)}</span>
            </div>
          </div>
        </div>

        <!-- Reported symptoms -->
        <div class="bg-white rounded-xl border border-gray-200" id="syms-card">
          <div class="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <p class="text-sm font-semibold text-gray-900">
              Reported Symptoms
              <span class="text-gray-400 font-normal ml-1">(${ptSyms.length})</span>
            </p>
            <button class="btn-primary text-xs py-1.5" onclick="showReportSymptomModal(${id})">
              + Report Symptom
            </button>
          </div>
          ${ptSyms.length === 0
            ? '<p class="px-5 py-8 text-center text-sm text-gray-400">No symptoms reported yet.</p>'
            : `<div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                      <th class="text-left px-5 py-3">Symptom</th>
                      <th class="text-left px-5 py-3">Severity</th>
                      <th class="text-left px-5 py-3">Duration</th>
                      <th class="text-left px-5 py-3">Reported</th>
                      <th class="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ptSyms.map(s => `
                      <tr class="border-b border-gray-50">
                        <td class="px-5 py-3">
                          <span class="font-medium text-gray-900">${s.symptom.name}</span>
                          <span class="ml-1">${catBadge(s.symptom.category)}</span>
                        </td>
                        <td class="px-5 py-3">${severityBadge(s.severity)}</td>
                        <td class="px-5 py-3 text-gray-500">${s.duration_days} day${s.duration_days !== 1 ? 's' : ''}</td>
                        <td class="px-5 py-3 text-gray-500">${fmtDate(s.reported_at)}</td>
                        <td class="px-5 py-3 text-right">
                          <button onclick="removeSymptom(${id},${s.id})"
                                  class="text-gray-300 hover:text-red-500 transition-colors" title="Remove">
                            ${iconTrash}
                          </button>
                        </td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>`}
        </div>

        <!-- Assessments -->
        <div class="bg-white rounded-xl border border-gray-200">
          <div class="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <p class="text-sm font-semibold text-gray-900">
              Assessments
              <span class="text-gray-400 font-normal ml-1">(${assessments.length})</span>
            </p>
            <button class="btn-primary text-xs py-1.5" onclick="showAddAssessmentModal(${id})">
              + Add Assessment
            </button>
          </div>
          ${assessments.length === 0
            ? '<p class="px-5 py-8 text-center text-sm text-gray-400">No assessments yet.</p>'
            : assessments.slice().reverse().map(a => `
              <div class="px-5 py-4 border-b border-gray-50 last:border-0 flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm text-gray-700">${a.notes || '<span class="italic text-gray-400">No notes</span>'}</p>
                  <p class="text-xs text-gray-400 mt-1">${fmtDate(a.created_at)}</p>
                </div>
                ${actionBadge(a.recommended_action)}
              </div>`).join('')}
        </div>

      </div>`);

  } catch (err) {
    setContent(`<div class="text-center py-20 text-red-400 text-sm">${err.message}</div>`);
  }
}

function showReportSymptomModal(patientId) {
  openModal('Report Symptom', `
    <form id="f-rep-sym" class="space-y-4">
      <div>
        <label class="label">Symptom</label>
        <select name="symptom_id" required class="input">
          <option value="">Select symptom…</option>
          ${_allSymptoms.map(s => `<option value="${s.id}">${s.name} (${s.category || 'general'})</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label">Severity — <span id="sev-val">5</span> / 10</label>
        <input type="range" name="severity" min="1" max="10" value="5"
               oninput="document.getElementById('sev-val').textContent=this.value"
               class="w-full accent-blue-600 mt-1"/>
        <div class="flex justify-between text-xs text-gray-400 mt-1"><span>Mild (1)</span><span>Severe (10)</span></div>
      </div>
      <div>
        <label class="label">Duration (days)</label>
        <input name="duration_days" type="number" min="1" value="1" required class="input"/>
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button type="button" onclick="closeModal()" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Report</button>
      </div>
    </form>`);

  document.getElementById('f-rep-sym').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post(`/patients/${patientId}/symptoms`, {
        symptom_id: +fd.get('symptom_id'),
        severity: +fd.get('severity'),
        duration_days: +fd.get('duration_days'),
      });
      closeModal(); toast('Symptom reported');
      renderPatientDetail(patientId);
    } catch (err) { toast(err.message, 'error'); }
  });
}

function showAddAssessmentModal(patientId) {
  openModal('Add Assessment', `
    <form id="f-add-assess" class="space-y-4">
      <div>
        <label class="label">Notes</label>
        <textarea name="notes" rows="3" class="input" placeholder="Clinical observations…"></textarea>
      </div>
      <div>
        <label class="label">Recommended Action</label>
        <select name="recommended_action" required class="input">
          <option value="">Select…</option>
          <option value="monitor_at_home">Monitor at Home</option>
          <option value="visit_clinic">Visit Clinic</option>
          <option value="go_to_er">Go to ER</option>
          <option value="schedule_followup">Schedule Follow-up</option>
        </select>
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button type="button" onclick="closeModal()" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Save</button>
      </div>
    </form>`);

  document.getElementById('f-add-assess').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post(`/patients/${patientId}/assessments`, {
        notes: fd.get('notes') || null,
        recommended_action: fd.get('recommended_action'),
      });
      closeModal(); toast('Assessment saved');
      renderPatientDetail(patientId);
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function removeSymptom(patientId, entryId) {
  if (!confirm('Remove this symptom record?')) return;
  try {
    await api.del(`/patients/${patientId}/symptoms/${entryId}`);
    toast('Symptom removed');
    renderPatientDetail(patientId);
  } catch (err) { toast(err.message, 'error'); }
}

// ── Symptoms Library ──────────────────────────────────────────────────────────

let _symptoms = [];

async function renderSymptoms() {
  setTitle('Symptoms Library');
  setActions(`<button class="btn-primary" onclick="showAddSymptomModal()">+ Add Symptom</button>`);
  loading();
  _symptoms = await api.get('/symptoms');
  renderSymptomTable(_symptoms);
}

function renderSymptomTable(list) {
  setContent(`
    <div class="bg-white rounded-xl border border-gray-200">
      <div class="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
        <input type="text" placeholder="Search symptoms…"
               oninput="filterSymptoms(this.value)"
               class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <span class="text-xs text-gray-400">${list.length} symptoms</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <th class="text-left px-5 py-3">Name</th>
              <th class="text-left px-5 py-3">Category</th>
              <th class="text-left px-5 py-3">Description</th>
              <th class="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody id="sym-tbody">${symRows(list)}</tbody>
        </table>
      </div>
    </div>`);
}

function symRows(list) {
  if (!list.length) return `<tr><td colspan="4" class="px-5 py-12 text-center text-gray-400 text-sm">No symptoms found</td></tr>`;
  return list.map(s => `
    <tr class="border-b border-gray-50">
      <td class="px-5 py-3 font-medium text-gray-900">${s.name}</td>
      <td class="px-5 py-3">${catBadge(s.category)}</td>
      <td class="px-5 py-3 text-gray-500">${s.description || '—'}</td>
      <td class="px-5 py-3 text-right">
        <button onclick="deleteSymptom(${s.id},'${s.name.replace(/'/g, "\\'")}')"
                class="text-gray-300 hover:text-red-500 transition-colors" title="Delete">
          ${iconTrash}
        </button>
      </td>
    </tr>`).join('');
}

function filterSymptoms(q) {
  const lq = q.toLowerCase();
  const filtered = _symptoms.filter(s =>
    s.name.toLowerCase().includes(lq) || (s.category || '').toLowerCase().includes(lq)
  );
  document.getElementById('sym-tbody').innerHTML = symRows(filtered);
}

function showAddSymptomModal() {
  openModal('Add Symptom', `
    <form id="f-add-sym" class="space-y-4">
      <div>
        <label class="label">Name</label>
        <input name="name" required class="input" placeholder="e.g. Chest Tightness"/>
      </div>
      <div>
        <label class="label">Category</label>
        <select name="category" class="input">
          <option value="">Select category…</option>
          <option value="general">General</option>
          <option value="respiratory">Respiratory</option>
          <option value="cardiac">Cardiac</option>
          <option value="neurological">Neurological</option>
          <option value="gastrointestinal">Gastrointestinal</option>
          <option value="musculoskeletal">Musculoskeletal</option>
          <option value="dermatological">Dermatological</option>
        </select>
      </div>
      <div>
        <label class="label">Description</label>
        <textarea name="description" rows="2" class="input" placeholder="Brief description…"></textarea>
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button type="button" onclick="closeModal()" class="btn-secondary">Cancel</button>
        <button type="submit" class="btn-primary">Add</button>
      </div>
    </form>`);

  document.getElementById('f-add-sym').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/symptoms/', {
        name: fd.get('name'),
        category: fd.get('category') || null,
        description: fd.get('description') || null,
      });
      closeModal(); toast('Symptom added');
      renderSymptoms();
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function deleteSymptom(id, name) {
  if (!confirm(`Delete symptom "${name}"?`)) return;
  try {
    await api.del(`/symptoms/${id}`);
    toast('Symptom deleted');
    renderSymptoms();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const iconTrash = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;

// ── Router ────────────────────────────────────────────────────────────────────

function navigate(hash) { location.hash = hash; }

function setActiveNav(hash) {
  const page = hash.startsWith('#patient/') ? 'patients' : hash.replace('#', '');
  document.querySelectorAll('.nav-link').forEach(el => {
    const match = el.dataset.page === page;
    el.classList.toggle('active', match);
  });
}

async function route() {
  const hash = location.hash || '#dashboard';
  setActiveNav(hash);

  if (hash.startsWith('#patient/')) {
    await renderPatientDetail(hash.split('/')[1]);
    return;
  }

  const pages = {
    '#dashboard': renderDashboard,
    '#patients':  renderPatients,
    '#symptoms':  renderSymptoms,
  };

  const handler = pages[hash];
  if (handler) await handler();
}

window.addEventListener('hashchange', route);
window.addEventListener('load', route);
