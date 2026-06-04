/**
 * js/doctors.js
 * Doctor list rendering, search/filter, and CRUD modal forms.
 */

const Doctors = (() => {

    // ── Render ────────────────────────────────────────────────────────────

    const render = async (filters = {}) => {
        const container = document.getElementById('doctors-table-container');
        container.innerHTML = loadingHTML();

        try {
            const res = await Api.doctors.getAll(filters);
            const doctors = res.data;

            if (!doctors.length) {
                container.innerHTML = emptyHTML('No doctors found.');
                return;
            }

            const isAdmin = Auth.can('admin');

            container.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Specialty</th>
                            <th class="hide-mobile">Department</th>
                            <th class="hide-mobile">Contact</th>
                            ${isAdmin ? '<th>Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${doctors.map((d) => `
                            <tr>
                                <td class="text-muted text-sm">${d.id}</td>
                                <td><span class="fw-600">${escHtml(d.name)}</span></td>
                                <td><span class="badge badge-specialty">${d.specialty}</span></td>
                                <td class="hide-mobile">${escHtml(d.department)}</td>
                                <td class="hide-mobile text-sm text-muted">
                                    ${d.contact_info?.phone || '—'}<br/>
                                    ${d.contact_info?.email || ''}
                                </td>
                                ${isAdmin ? `
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn btn-secondary btn-icon" title="Edit"
                                                onclick="Doctors.openEditModal(${d.id})">
                                                <i data-feather="edit-2"></i>
                                            </button>
                                            <button class="btn btn-danger btn-icon" title="Delete"
                                                onclick="Doctors.confirmDelete(${d.id}, '${escHtml(d.name)}')">
                                                <i data-feather="trash-2"></i>
                                            </button>
                                        </div>
                                    </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            renderIcons();
        } catch (err) {
            console.error('[Doctors.render]', err);
            container.innerHTML = errorHTML(err.message || 'Failed to load doctors.');
        }
    };

    // ── Modal: Add Doctor ─────────────────────────────────────────────────

    const openAddModal = () => {
        Modal.open({
            title:     'Add New Doctor',
            body:      formHTML(),
            onConfirm: handleCreate,
        });
    };

    // ── Modal: Edit Doctor ────────────────────────────────────────────────

    const openEditModal = async (id) => {
        Modal.open({ title: 'Edit Doctor', body: loadingHTML(), onConfirm: () => handleUpdate(id) });

        try {
            const res = await Api.doctors.getOne(id);
            const d   = res.data;
            Modal.setBody(formHTML(d, true));
            renderIcons();
        } catch (err) {
            Modal.setBody(errorHTML(err.message));
        }
    };

    // ── Modal: Confirm Delete ─────────────────────────────────────────────

    const confirmDelete = (id, name) => {
        Modal.open({
            title:     'Delete Doctor',
            body:      confirmHTML(`Are you sure you want to delete <strong>${escHtml(name)}</strong>?
                        <br/><span class="text-sm">This will fail if the doctor still has patients assigned.</span>`),
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
            await Api.doctors.create(body);
            Modal.close();
            App.showAlert('Doctor created successfully.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    const handleUpdate = async (id) => {
        const body = collectForm(true);
        if (!body) return;
        try {
            await Api.doctors.update(id, body);
            Modal.close();
            App.showAlert('Doctor updated successfully.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await Api.doctors.delete(id);
            Modal.close();
            App.showAlert('Doctor deleted.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    // ── Form Helpers ──────────────────────────────────────────────────────

    const formHTML = (d = {}, isEdit = false) => {
        const specialties = ['Cardiology', 'Neurology', 'Dermatology', 'Orthopedics', 'General Practice'];
        const contact = d.contact_info || {};
        return `
            <div class="form-group">
                <label>Full Name *</label>
                <input id="f-name" type="text" value="${escHtml(d.name || '')}" placeholder="Dr. Jane Smith" required />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Specialty *</label>
                    <select id="f-specialty">
                        ${specialties.map((s) => `<option ${d.specialty === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Department *</label>
                    <input id="f-department" type="text" value="${escHtml(d.department || '')}" placeholder="e.g., Cardiovascular Unit" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Phone</label>
                    <input id="f-phone" type="text" value="${escHtml(contact.phone || '')}" placeholder="+1-555-0100" />
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input id="f-email" type="email" value="${escHtml(contact.email || '')}" placeholder="dr@caretrack.com" />
                </div>
            </div>
            <div class="form-group">
                <label>Office Location</label>
                <input id="f-office" type="text" value="${escHtml(contact.office || '')}" placeholder="Block A, Room 204" />
            </div>
            ${!isEdit ? `
            <hr style="margin:1rem 0;border:none;border-top:1px solid var(--color-border)" />
            <p style="font-size:.8rem;font-weight:600;color:var(--color-text-muted);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">Login Account</p>
            <div class="form-row">
                <div class="form-group">
                    <label>Username *</label>
                    <input id="f-username" type="text" placeholder="e.g., dr_smith" />
                </div>
                <div class="form-group">
                    <label>Password *</label>
                    <input id="f-password" type="password" placeholder="Min 8 characters" />
                </div>
            </div>
            ` : ''}
            <div id="form-error" class="alert alert-error" hidden></div>
        `;
    };

    const collectForm = (isEdit = false) => {
        const name       = document.getElementById('f-name')?.value.trim();
        const specialty  = document.getElementById('f-specialty')?.value;
        const department = document.getElementById('f-department')?.value.trim();
        const phone      = document.getElementById('f-phone')?.value.trim();
        const email      = document.getElementById('f-email')?.value.trim();
        const office     = document.getElementById('f-office')?.value.trim();

        if (!name || !specialty || !department) {
            const err = document.getElementById('form-error');
            if (err) { err.textContent = 'Name, specialty, and department are required.'; err.hidden = false; }
            return null;
        }

        const body = { name, specialty, department, contact_info: { phone, email, office } };

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
