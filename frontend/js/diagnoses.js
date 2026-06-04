/**
 * js/diagnoses.js
 * Diagnosis list rendering, search/filter, and CRUD modal forms.
 */

const Diagnoses = (() => {

    // ── Render ────────────────────────────────────────────────────────────

    const render = async (filters = {}) => {
        const container = document.getElementById('diagnoses-table-container');
        container.innerHTML = loadingHTML();

        try {
            const res       = await Api.diagnoses.getAll(filters);
            const diagnoses = res.data;

            if (!diagnoses.length) {
                container.innerHTML = emptyHTML('No diagnoses found.');
                return;
            }

            const canEdit   = Auth.can('admin', 'clinician');
            const canDelete = Auth.can('admin');

            container.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>ICD Code</th>
                            <th>Description</th>
                            <th>Severity</th>
                            <th class="hide-mobile">Patient</th>
                            <th class="hide-mobile">Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${diagnoses.map((d) => `
                            <tr>
                                <td><code style="font-family:var(--font-mono);font-size:.8rem;color:var(--color-primary)">${escHtml(d.icd_code)}</code></td>
                                <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                                    title="${escHtml(d.description)}">${escHtml(d.description)}</td>
                                <td><span class="badge badge-${d.severity_level.toLowerCase()}">${d.severity_level}</span></td>
                                <td class="hide-mobile">
                                    <a style="color:var(--color-primary);cursor:pointer"
                                        onclick="App.navigate('patient-profile', ${d.patient_id})">
                                        ${escHtml(d.patient_name)}
                                    </a>
                                </td>
                                <td class="hide-mobile text-sm text-muted">${formatDate(d.diagnosed_at)}</td>
                                <td>
                                    <div class="table-actions">
                                        ${canEdit ? `
                                            <button class="btn btn-secondary btn-icon" title="Edit"
                                                onclick="Diagnoses.openEditModal(${d.id})">
                                                <i data-feather="edit-2"></i>
                                            </button>
                                        ` : ''}
                                        ${canDelete ? `
                                            <button class="btn btn-danger btn-icon" title="Delete"
                                                onclick="Diagnoses.confirmDelete(${d.id}, '${escHtml(d.icd_code)}')">
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

    // ── Modal: Add Diagnosis ──────────────────────────────────────────────

    const openAddModal = async (prefilledPatientId = null) => {
        Modal.open({ title: 'Add Diagnosis', body: loadingHTML(), onConfirm: handleCreate });
        const patients = await fetchPatients();
        Modal.setBody(formHTML({ patient_id: prefilledPatientId }, patients));
        feather.replace();
    };

    // ── Modal: Edit Diagnosis ─────────────────────────────────────────────

    const openEditModal = async (id) => {
        Modal.open({ title: 'Edit Diagnosis', body: loadingHTML(), onConfirm: () => handleUpdate(id) });
        const [dRes, patients] = await Promise.all([Api.diagnoses.getOne(id), fetchPatients()]);
        Modal.setBody(formHTML(dRes.data, patients));
        feather.replace();
    };

    // ── Modal: Confirm Delete ─────────────────────────────────────────────

    const confirmDelete = (id, code) => {
        Modal.open({
            title:        'Delete Diagnosis',
            body:         confirmHTML(`Delete diagnosis record <strong>${escHtml(code)}</strong>? This cannot be undone.`),
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
            await Api.diagnoses.create(body);
            Modal.close();
            App.showAlert('Diagnosis recorded successfully.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    const handleUpdate = async (id) => {
        const body = collectForm();
        if (!body) return;
        try {
            await Api.diagnoses.update(id, body);
            Modal.close();
            App.showAlert('Diagnosis updated.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await Api.diagnoses.delete(id);
            Modal.close();
            App.showAlert('Diagnosis deleted.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    // ── Form Helpers ──────────────────────────────────────────────────────

    const fetchPatients = async () => {
        try { const r = await Api.patients.getAll(); return r.data; } catch { return []; }
    };

    const formHTML = (d = {}, patients = []) => `
        <div class="form-row">
            <div class="form-group">
                <label>ICD Code *</label>
                <input id="f-icd" type="text" value="${escHtml(d.icd_code || '')}" placeholder="e.g., I21.0" />
            </div>
            <div class="form-group">
                <label>Severity *</label>
                <select id="f-severity">
                    <option value="">— select —</option>
                    ${['Low','Medium','High'].map((s) => `<option ${d.severity_level === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Description *</label>
            <textarea id="f-desc" placeholder="Clinical description of the diagnosis…">${escHtml(d.description || '')}</textarea>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Patient *</label>
                <select id="f-patient">
                    <option value="">— select patient —</option>
                    ${patients.map((p) => `<option value="${p.id}" ${Number(d.patient_id) === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Date Diagnosed *</label>
                <input id="f-date" type="date" value="${d.diagnosed_at ? d.diagnosed_at.split('T')[0] : new Date().toISOString().split('T')[0]}" />
            </div>
        </div>
        <div class="form-group">
            <label>Clinical Notes</label>
            <textarea id="f-notes" placeholder="Optional clinical notes…">${escHtml(d.notes || '')}</textarea>
        </div>
        <div id="form-error" class="alert alert-error" hidden></div>
    `;

    const collectForm = () => {
        const icd_code       = document.getElementById('f-icd')?.value.trim();
        const severity_level = document.getElementById('f-severity')?.value;
        const description    = document.getElementById('f-desc')?.value.trim();
        const patient_id     = document.getElementById('f-patient')?.value;
        const diagnosed_at   = document.getElementById('f-date')?.value;
        const notes          = document.getElementById('f-notes')?.value.trim();

        if (!icd_code || !severity_level || !description || !patient_id) {
            const err = document.getElementById('form-error');
            if (err) { err.textContent = 'ICD code, severity, description, and patient are required.'; err.hidden = false; }
            return null;
        }
        return { icd_code, severity_level, description, patient_id: Number(patient_id), diagnosed_at, notes: notes || null };
    };

    return { render, openAddModal, openEditModal, confirmDelete };
})();
