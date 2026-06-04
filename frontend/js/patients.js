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

            container.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Gender</th>
                            <th class="hide-mobile">DOB</th>
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
                                <td>${p.gender}</td>
                                <td class="hide-mobile text-sm">${formatDate(p.dob)}</td>
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
            feather.replace();
        } catch (err) {
            container.innerHTML = errorHTML(err.message);
        }
    };

    // ── Modal: Add Patient ────────────────────────────────────────────────

    const openAddModal = async () => {
        Modal.open({ title: 'Register New Patient', body: loadingHTML(), onConfirm: handleCreate });
        const doctors = await fetchDoctors();
        Modal.setBody(formHTML({}, doctors));
        feather.replace();
    };

    // ── Modal: Edit Patient ───────────────────────────────────────────────

    const openEditModal = async (id) => {
        Modal.open({ title: 'Edit Patient', body: loadingHTML(), onConfirm: () => handleUpdate(id) });
        const [patRes, doctors] = await Promise.all([Api.patients.getOne(id), fetchDoctors()]);
        Modal.setBody(formHTML(patRes.data, doctors));
        feather.replace();
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
        const body = collectForm();
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

    const formHTML = (p = {}, doctors = []) => `
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
            <div class="form-group">
                <label>Assigned Doctor *</label>
                <select id="f-doctor">
                    <option value="">— select doctor —</option>
                    ${doctors.map((d) => `<option value="${d.id}" ${p.doctor_id === d.id ? 'selected' : ''}>${escHtml(d.name)} (${d.specialty})</option>`).join('')}
                </select>
            </div>
        </div>
        <div id="form-error" class="alert alert-error" hidden></div>
    `;

    const collectForm = () => {
        const name      = document.getElementById('f-name')?.value.trim();
        const dob       = document.getElementById('f-dob')?.value;
        const gender    = document.getElementById('f-gender')?.value;
        const phone     = document.getElementById('f-phone')?.value.trim();
        const doctor_id = document.getElementById('f-doctor')?.value;

        if (!name || !dob || !gender || !doctor_id) {
            const err = document.getElementById('form-error');
            if (err) { err.textContent = 'Name, date of birth, gender, and doctor are required.'; err.hidden = false; }
            return null;
        }
        return { name, dob, phone, gender, doctor_id: Number(doctor_id) };
    };

    return { render, openAddModal, openEditModal, confirmDelete };
})();
