/**
 * js/patients.js
 * Patient list rendering, search/filter, CRUD modal forms.
 * Clicking a patient row navigates to the Patient Profile view.
 */

const Patients = (() => {

    // ── Render ────────────────────────────────────────────────────────────

    const render = async (filters = {}) => {
        const container = document.getElementById('patients-table-container');
        container.innerHTML = loadingHTML();

        try {
            const res      = await Api.patients.getAll(filters);
            const patients = res.data;

            if (!patients.length) {
                container.innerHTML = emptyHTML('No patients found.');
                return;
            }

            const canEdit   = Auth.can('admin', 'clinician');
            const canDelete = Auth.can('admin');

            const isClinician = Auth.getUser()?.role === 'clinician';
            const statusBadge = (p) => {
                if (isClinician) {
                    return p.has_pending_appointment
                        ? `<span class="badge badge-pending">Pending</span>`
                        : `<span class="badge badge-diagnosed">Diagnosed</span>`;
                }
                return Number(p.diagnosis_count) > 0
                    ? `<span class="badge badge-diagnosed">Diagnosed</span>`
                    : `<span class="badge badge-pending">Pending</span>`;
            };

            container.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Status</th>
                            <th class="hide-mobile">Gender</th>
                            <th class="hide-mobile">Assigned Doctor</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${patients.map((p) => `
                            <tr>
                                <td class="text-muted text-sm">${p.id}</td>
                                <td>
                                    <a class="fw-600" style="color:var(--color-primary);cursor:pointer"
                                        onclick="App.navigate('patient-profile', ${p.id})">
                                        ${escHtml(p.name)}
                                    </a>
                                </td>
                                <td>${statusBadge(p)}</td>
                                <td class="hide-mobile">${p.gender}</td>
                                <td class="hide-mobile">
                                    <span class="text-sm">${escHtml(p.doctor_name)}</span><br/>
                                    <span class="badge badge-specialty" style="font-size:.65rem">${p.doctor_specialty}</span>
                                </td>
                                <td>
                                    <div class="table-actions">
                                        <button class="btn btn-secondary btn-icon" title="View Profile"
                                            onclick="App.navigate('patient-profile', ${p.id})">
                                            <i data-feather="eye"></i>
                                        </button>
                                        ${canEdit ? `
                                            <button class="btn btn-secondary btn-icon" title="Edit"
                                                onclick="Patients.openEditModal(${p.id})">
                                                <i data-feather="edit-2"></i>
                                            </button>
                                        ` : ''}
                                        ${canDelete ? `
                                            <button class="btn btn-danger btn-icon" title="Delete"
                                                onclick="Patients.confirmDelete(${p.id}, '${escHtml(p.name)}')">
                                                <i data-feather="trash-2"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            renderIcons();
        } catch (err) {
            console.error('[Patients.render]', err);
            container.innerHTML = errorHTML(err.message || 'Failed to load patients.');
        }
    };

    // ── Modal: Add Patient ────────────────────────────────────────────────

    const openAddModal = async () => {
        Modal.open({ title: 'Register New Patient', body: loadingHTML(), onConfirm: handleCreate });
        const doctors = await fetchDoctors();
        Modal.setBody(formHTML({}, doctors));
        renderIcons();
    };

    // ── Modal: Edit Patient ───────────────────────────────────────────────

    const openEditModal = async (id) => {
        Modal.open({ title: 'Edit Patient', body: loadingHTML(), onConfirm: () => handleUpdate(id) });
        const isClinician = Auth.getUser()?.role === 'clinician';
        const [patRes, doctors] = await Promise.all([
            Api.patients.getOne(id),
            isClinician ? Promise.resolve([]) : fetchDoctors(),
        ]);
        Modal.setBody(formHTML(patRes.data, doctors, isClinician, true));
        renderIcons();
    };

    // ── Modal: Confirm Delete ─────────────────────────────────────────────

    const confirmDelete = (id, name) => {
        Modal.open({
            title:        'Delete Patient',
            body:         confirmHTML(`Delete <strong>${escHtml(name)}</strong>? All their diagnosis records will also be removed.`),
            confirmLabel: 'Delete',
            confirmClass: 'btn-danger',
            onConfirm:    () => handleDelete(id),
        });
    };

    // ── CRUD Handlers ─────────────────────────────────────────────────────

    const handleCreate = async () => {
        const body = collectForm();
        if (!body) return;
        try {
            await Api.patients.create(body);
            Modal.close();
            App.showAlert('Patient registered successfully.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    const handleUpdate = async (id) => {
        const body = collectForm(true);
        if (!body) return;
        try {
            await Api.patients.update(id, body);
            Modal.close();
            App.showAlert('Patient updated successfully.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await Api.patients.delete(id);
            Modal.close();
            App.showAlert('Patient deleted.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    // ── Form Helpers ──────────────────────────────────────────────────────

    const fetchDoctors = async () => {
        try {
            const res = await Api.doctors.getAll();
            return res.data;
        } catch {
            return [];
        }
    };

    const formHTML = (p = {}, doctors = [], isClinician = false, isEdit = false) => `
        <div class="form-group">
            <label>Full Name *</label>
            <input id="f-name" type="text" value="${escHtml(p.name || '')}" placeholder="e.g., Alice Thompson" required />
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Date of Birth *</label>
                <input id="f-dob" type="date" value="${p.dob ? p.dob.split('T')[0] : ''}" required />
            </div>
            <div class="form-group">
                <label>Gender *</label>
                <select id="f-gender">
                    <option value="">— select —</option>
                    ${['Male','Female','Other'].map((g) => `<option ${p.gender === g ? 'selected' : ''}>${g}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Phone</label>
                <input id="f-phone" type="text" value="${escHtml(p.phone || '')}" placeholder="+1-555-0100" />
            </div>
            ${!isClinician ? `
            <div class="form-group">
                <label>Assigned Doctor *</label>
                <select id="f-doctor">
                    <option value="">— select doctor —</option>
                    ${doctors.map((d) => `<option value="${d.id}" ${p.doctor_id === d.id ? 'selected' : ''}>${escHtml(d.name)} (${d.specialty})</option>`).join('')}
                </select>
            </div>
            ` : ''}
        </div>
        ${!isEdit ? `
        <hr style="margin:1rem 0;border:none;border-top:1px solid var(--color-border)" />
        <p style="font-size:.8rem;font-weight:600;color:var(--color-text-muted);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">Patient Login Account</p>
        <div class="form-row">
            <div class="form-group">
                <label>Username *</label>
                <input id="f-username" type="text" placeholder="e.g., alice_t" />
            </div>
            <div class="form-group">
                <label>Password *</label>
                <input id="f-password" type="password" placeholder="Min 8 characters" />
            </div>
        </div>
        ` : ''}
        <div id="form-error" class="alert alert-error" hidden></div>
    `;

    const collectForm = (isEdit = false) => {
        const name      = document.getElementById('f-name')?.value.trim();
        const dob       = document.getElementById('f-dob')?.value;
        const gender    = document.getElementById('f-gender')?.value;
        const phone     = document.getElementById('f-phone')?.value.trim();
        const doctorEl  = document.getElementById('f-doctor');
        const doctor_id = doctorEl?.value || '';

        const requiresDoctor = !!doctorEl;
        if (!name || !dob || !gender || (requiresDoctor && !doctor_id)) {
            const err = document.getElementById('form-error');
            if (err) {
                err.textContent = requiresDoctor
                    ? 'Name, date of birth, gender, and doctor are required.'
                    : 'Name, date of birth, and gender are required.';
                err.hidden = false;
            }
            return null;
        }

        const body = { name, dob, phone, gender };
        if (doctor_id) body.doctor_id = Number(doctor_id);

        if (!isEdit) {
            const username = document.getElementById('f-username')?.value.trim();
            const password = document.getElementById('f-password')?.value;
            if (!username || !password) {
                const err = document.getElementById('form-error');
                if (err) { err.textContent = 'Username and password are required.'; err.hidden = false; }
                return null;
            }
            body.username = username;
            body.password = password;
        }

        return body;
    };

    return { render, openAddModal, openEditModal, confirmDelete };
})();
