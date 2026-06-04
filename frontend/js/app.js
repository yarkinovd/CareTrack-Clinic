/**
 * js/app.js
 * Main application controller — SPA router, modal manager, shared utilities.
 *
 * Responsibilities:
 *   • Bootstrap: check auth, show login or app shell.
 *   • Login form handling.
 *   • Navigation between views (navigate(viewName, [id])).
 *   • Dashboard stats loading.
 *   • Modal open/close/body-swap API.
 *   • Shared DOM utility functions (escHtml, formatDate, loadingHTML, …).
 */

// ═══════════════════════════════════════════════════════════════════════════
// DOM REFERENCES
// ═══════════════════════════════════════════════════════════════════════════

const $ = (id) => document.getElementById(id);

// Safe feather icon renderer — silently skips if CDN failed to load
const renderIcons = () => {
    try { if (typeof feather !== 'undefined') feather.replace(); } catch (_) {}
};

// ═══════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES (used by all feature modules via global scope)
// ═══════════════════════════════════════════════════════════════════════════

/** Escape HTML to prevent XSS when inserting user-supplied text into innerHTML. */
function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Format an ISO date string or Date object to locale-friendly string. */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    } catch {
        return String(dateStr);
    }
}

/** Standard loading spinner HTML used by every feature module. */
function loadingHTML() {
    return `<div class="loading-state"><div class="spinner-lg"></div><p>Loading…</p></div>`;
}

/** Standard empty-state HTML. */
function emptyHTML(msg = 'No records found.') {
    return `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg><p>${escHtml(msg)}</p></div>`;
}

/** Standard error-state HTML. */
function errorHTML(msg) {
    return `<div class="empty-state" style="color:var(--color-danger)"><p>⚠ ${escHtml(msg)}</p></div>`;
}

/** Confirm dialog body HTML. */
function confirmHTML(innerHtml) {
    return `<div class="confirm-body"><div class="confirm-icon">⚠️</div><div>${innerHtml}</div></div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL MANAGER
// Provides a generic reusable modal:
//   Modal.open({ title, body, onConfirm, confirmLabel, confirmClass })
//   Modal.close()
//   Modal.setBody(html) — swap body without closing (used after async data fetch)
//   Modal.showError(msg) — show inline error inside the modal body
// ═══════════════════════════════════════════════════════════════════════════

const Modal = (() => {
    let _onConfirm = null;

    const overlay  = $('modal-overlay');
    const title    = $('modal-title');
    const body     = $('modal-body');
    const footer   = $('modal-footer');
    const confirmBtn = $('modal-confirm');
    const closeBtn   = $('modal-close');
    const cancelBtn  = $('modal-cancel');

    const open = ({ title: t, body: b, onConfirm, confirmLabel = 'Save', confirmClass = 'btn-primary' }) => {
        _onConfirm = onConfirm;
        title.textContent    = t;
        body.innerHTML       = b;
        confirmBtn.textContent = confirmLabel;
        confirmBtn.className = `btn ${confirmClass}`;
        overlay.hidden       = false;
        renderIcons();
    };

    const close = () => {
        overlay.hidden = true;
        body.innerHTML = '';
        _onConfirm     = null;
    };

    const setBody = (html) => {
        body.innerHTML = html;
        renderIcons();
    };

    const showError = (msg) => {
        // Remove previous error if any
        const prev = body.querySelector('.modal-inline-error');
        if (prev) prev.remove();
        const el = document.createElement('div');
        el.className = 'alert alert-error modal-inline-error';
        el.style.marginTop = '.75rem';
        el.textContent = msg;
        body.appendChild(el);
    };

    confirmBtn.addEventListener('click', () => { if (_onConfirm) _onConfirm(); });
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) close(); });

    return { open, close, setBody, showError };
})();

// ═══════════════════════════════════════════════════════════════════════════
// APP CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

const App = (() => {

    // ── State ─────────────────────────────────────────────────────────────
    // currentView tracks which section is visible so we can re-fetch on return.
    let currentView    = 'dashboard';
    let profilePatientId = null;

    // ── Bootstrap ─────────────────────────────────────────────────────────

    const init = () => {
        bindLoginForm();
        bindRegisterForm();
        bindNavigation();
        bindSidebar();
        bindToolbars();

        if (Auth.isLoggedIn()) {
            showApp();
        } else {
            $('login-screen').hidden = false;
            $('app').hidden          = true;
        }
    };

    // ── Login / Register toggle ────────────────────────────────────────────

    const bindLoginForm = () => {
        $('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = $('login-username').value.trim();
            const password = $('login-password').value;
            const errorEl  = $('login-error');
            const spinner  = $('login-spinner');
            const btnText  = $('login-btn-text');

            errorEl.hidden = true;
            spinner.hidden = false;
            btnText.textContent = 'Signing in…';

            try {
                const res = await Api.auth.login({ username, password });
                Auth.saveSession(res.token, res.user);
                showApp();
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.hidden      = false;
            } finally {
                spinner.hidden = true;
                btnText.textContent = 'Sign In';
            }
        });
    };

    // ── Register Form ──────────────────────────────────────────────────────

    const bindRegisterForm = () => {
        // Toggle between login and register panels
        $('goto-register').addEventListener('click', async (e) => {
            e.preventDefault();
            $('login-card').hidden    = true;
            $('register-card').hidden = false;

            // Load doctors list into dropdown
            const select = $('reg-doctor');
            try {
                const res = await Api.doctors.getPublic();
                select.innerHTML = '<option value="">— select a doctor —</option>' +
                    res.data.map((d) => `<option value="${d.id}">${escHtml(d.name)} (${d.specialty})</option>`).join('');
            } catch {
                select.innerHTML = '<option value="">Failed to load doctors</option>';
            }
        });

        $('goto-login').addEventListener('click', (e) => {
            e.preventDefault();
            $('register-card').hidden = true;
            $('login-card').hidden    = false;
        });

        $('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const name      = $('reg-name').value.trim();
            const dob       = $('reg-dob').value;
            const gender    = $('reg-gender').value;
            const phone     = $('reg-phone').value.trim();
            const doctor_id = $('reg-doctor').value;
            const username  = $('reg-username').value.trim();
            const password  = $('reg-password').value;

            const errorEl = $('register-error');
            errorEl.hidden = true;

            if (!name || !dob || !gender || !doctor_id || !username || !password) {
                errorEl.textContent = 'All required fields must be filled in.';
                errorEl.hidden = false;
                return;
            }

            const spinner = $('register-spinner');
            const btnText = $('register-btn-text');
            spinner.hidden = false;
            btnText.textContent = 'Creating account…';

            try {
                const res = await Api.auth.registerPatient({ name, dob, gender, phone, doctor_id, username, password });
                Auth.saveSession(res.token, res.user);
                $('register-card').hidden = true;
                showApp();
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.hidden = false;
            } finally {
                spinner.hidden = true;
                btnText.textContent = 'Create Account';
            }
        });
    };

    // ── Show App Shell ────────────────────────────────────────────────────

    const showApp = () => {
        $('login-screen').hidden = true;
        $('app').hidden          = false;

        Auth.renderUserUI();
        Auth.applyRoleVisibility();

        // Patient portal: go directly to their own profile, skip the full app shell
        if (Auth.can('patient')) {
            const user = Auth.getUser();
            navigate('my-profile', user.patient_id);
            renderIcons();
            return;
        }

        navigate('dashboard');
        renderIcons();
    };

    // ── Navigation ────────────────────────────────────────────────────────

    const bindNavigation = () => {
        document.querySelectorAll('.nav-item[data-view]').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navigate(link.dataset.view);
                // On mobile, close sidebar on nav click
                $('sidebar').classList.remove('open');
            });
        });

        $('logout-btn').addEventListener('click', () => Auth.logout());

        $('back-from-profile').addEventListener('click', () => navigate('patients'));
    };

    /**
     * navigate(viewName, [id])
     * Shows the requested view section and triggers its data fetch.
     * viewName: 'dashboard' | 'doctors' | 'patients' | 'diagnoses' | 'patient-profile'
     */
    const navigate = (viewName, id = null) => {
        // Update active nav link
        document.querySelectorAll('.nav-item').forEach((el) => {
            el.classList.toggle('active', el.dataset.view === viewName);
        });

        // Hide all views
        document.querySelectorAll('.view').forEach((v) => {
            v.hidden = true;
            v.classList.remove('active');
        });

        const viewMap = {
            'dashboard':       'view-dashboard',
            'doctors':         'view-doctors',
            'patients':        'view-patients',
            'diagnoses':       'view-diagnoses',
            'patient-profile': 'view-patient-profile',
            'my-profile':      'view-patient-profile',
        };

        const viewEl = $(viewMap[viewName]);
        if (!viewEl) return;

        viewEl.hidden = false;
        viewEl.classList.add('active');
        currentView = viewName;

        // Page title
        const titles = {
            'dashboard':       'Dashboard',
            'doctors':         'Doctors',
            'patients':        'Patients',
            'diagnoses':       'Diagnoses',
            'patient-profile': 'Patient Profile',
            'my-profile':      'My Profile',
        };
        $('page-title').textContent = titles[viewName] || viewName;

        // Load data for the active view
        switch (viewName) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'doctors':
                Doctors.render();
                break;
            case 'patients':
                Patients.render();
                break;
            case 'diagnoses':
                Diagnoses.render();
                break;
            case 'my-profile': {
                const user = Auth.getUser();
                if (user?.patient_id) {
                    profilePatientId = user.patient_id;
                    PatientProfile.render(user.patient_id);
                }
                break;
            }
            case 'patient-profile':
                if (id) {
                    profilePatientId = id;
                    PatientProfile.render(id);
                }
                break;
        }
    };

    // ── Dashboard ─────────────────────────────────────────────────────────

    const loadDashboard = async () => {
        // Fetch counts in parallel
        const promises = [
            Api.doctors.getAll(),
            Api.patients.getAll(),
        ];

        // Clinicians & admins also see diagnosis count
        if (Auth.can('admin', 'clinician')) {
            promises.push(Api.diagnoses.getAll());
        }

        try {
            const [drRes, ptRes, dgRes] = await Promise.all(promises);
            $('stat-doctors').textContent   = drRes.count;
            $('stat-patients').textContent  = ptRes.count;
            if (dgRes) $('stat-diagnoses').textContent = dgRes.count;

            // Hide diagnosis stat card for receptionist
            if (!Auth.can('admin', 'clinician')) {
                $('stat-diagnoses-card').style.display = 'none';
            }

            // Recent patients table (last 5)
            const recent = ptRes.data.slice(0, 5);
            $('recent-patients-table').innerHTML = recent.length
                ? `<table>
                    <thead><tr><th>Name</th><th>Gender</th><th>Doctor</th></tr></thead>
                    <tbody>
                        ${recent.map((p) => `
                            <tr>
                                <td><a style="color:var(--color-primary);cursor:pointer"
                                    onclick="App.navigate('patient-profile',${p.id})">${escHtml(p.name)}</a></td>
                                <td>${p.gender}</td>
                                <td>${escHtml(p.doctor_name)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                  </table>`
                : emptyHTML('No patients yet.');
            renderIcons();
        } catch (err) {
            console.error('Dashboard load error:', err);
        }
    };

    // ── Sidebar mobile toggle ──────────────────────────────────────────────

    const bindSidebar = () => {
        $('menu-toggle').addEventListener('click', () => {
            $('sidebar').classList.toggle('open');
        });
        $('sidebar-close').addEventListener('click', () => {
            $('sidebar').classList.remove('open');
        });
    };

    // ── Toolbar Search & Filter ─────────────────────────────────────────────

    const bindToolbars = () => {
        // Doctors search / filter — debounced
        let doctorTimer;
        $('doctor-search').addEventListener('input', (e) => {
            clearTimeout(doctorTimer);
            doctorTimer = setTimeout(() => Doctors.render({ search: e.target.value }), 350);
        });
        $('doctor-specialty-filter').addEventListener('change', (e) => {
            Doctors.render({ search: $('doctor-search').value, specialty: e.target.value });
        });
        $('add-doctor-btn').addEventListener('click', () => Doctors.openAddModal());

        // Patients search / filter
        let patientTimer;
        $('patient-search').addEventListener('input', (e) => {
            clearTimeout(patientTimer);
            patientTimer = setTimeout(() => Patients.render({ search: e.target.value }), 350);
        });
        $('patient-gender-filter').addEventListener('change', (e) => {
            Patients.render({ search: $('patient-search').value, gender: e.target.value });
        });
        $('add-patient-btn').addEventListener('click', () => Patients.openAddModal());

        // Diagnoses search / filter
        let diagTimer;
        $('diagnosis-search').addEventListener('input', (e) => {
            clearTimeout(diagTimer);
            diagTimer = setTimeout(() => Diagnoses.render({ search: e.target.value }), 350);
        });
        $('diagnosis-severity-filter').addEventListener('change', (e) => {
            Diagnoses.render({ search: $('diagnosis-search').value, severity: e.target.value });
        });
        $('add-diagnosis-btn').addEventListener('click', () => Diagnoses.openAddModal());
    };

    // ── App Alert Banner ──────────────────────────────────────────────────

    let alertTimer;
    const showAlert = (message, type = 'success') => {
        const el = $('app-alert');
        el.textContent = (type === 'success' ? '✓ ' : '⚠ ') + message;
        el.className   = `app-alert ${type}`;
        el.hidden      = false;

        clearTimeout(alertTimer);
        alertTimer = setTimeout(() => { el.hidden = true; }, 4000);
    };

    // ── Public API ────────────────────────────────────────────────────────
    return { init, navigate, showAlert };
})();

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT — run after all scripts are loaded
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => App.init());
