const Diagnoses = (() => {

    const DARAJALAR = [
        ['Low',    'Engil'],
        ['Medium', "O'rta"],
        ['High',   "Og'ir"],
    ];

    const darajaNomi = (val) => {
        const t = DARAJALAR.find(([v]) => v === val);
        return t ? t[1] : val;
    };

    // ── Ro'yxat ──────────────────────────────────────────────────────────

    const render = async (filters = {}) => {
        const container = document.getElementById('diagnoses-table-container');
        container.innerHTML = loadingHTML();

        try {
            const res       = await Api.diagnoses.getAll(filters);
            const diagnoses = res.data;

            if (!diagnoses.length) {
                container.innerHTML = emptyHTML('Tashxislar topilmadi.');
                return;
            }

            const canEdit   = Auth.can('admin', 'clinician');
            const canDelete = Auth.can('admin');

            container.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>ICD Kodi</th>
                            <th>Tavsif</th>
                            <th>Darajasi</th>
                            <th class="hide-mobile">Bemor</th>
                            <th class="hide-mobile">Sana</th>
                            <th>Amallar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${diagnoses.map((d) => `
                            <tr>
                                <td><code style="font-family:var(--font-mono);font-size:.8rem;color:var(--color-primary)">${escHtml(d.icd_code)}</code></td>
                                <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                                    title="${escHtml(d.description)}">${escHtml(d.description)}</td>
                                <td><span class="badge badge-${d.severity_level.toLowerCase()}">${darajaNomi(d.severity_level)}</span></td>
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
                                            <button class="btn btn-secondary btn-icon" title="Tahrirlash"
                                                onclick="Diagnoses.openEditModal(${d.id})">
                                                <i data-feather="edit-2"></i>
                                            </button>
                                        ` : ''}
                                        ${canDelete ? `
                                            <button class="btn btn-danger btn-icon" title="O'chirish"
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
            renderIcons();
        } catch (err) {
            container.innerHTML = errorHTML(err.message);
        }
    };

    // ── Modal: Tashxis qo'shish ───────────────────────────────────────────

    const openAddModal = async (prefilledPatientId = null) => {
        const isClinician = Auth.getUser()?.role === 'clinician';

        Modal.open({
            title:     'Tashxis qo\'yish',
            body:      loadingHTML(),
            onConfirm: () => handleCreate(prefilledPatientId),
        });

        if (prefilledPatientId && isClinician) {
            try {
                const patRes = await Api.patients.getOne(prefilledPatientId);
                Modal.setBody(formHTML({ patient_id: prefilledPatientId }, [], patRes.data.name));
            } catch {
                Modal.setBody(formHTML({ patient_id: prefilledPatientId }, []));
            }
        } else {
            const patients = await fetchPatients();
            Modal.setBody(formHTML({ patient_id: prefilledPatientId }, patients));
        }
        renderIcons();
    };

    // ── Modal: Tashxisni tahrirlash ───────────────────────────────────────

    const openEditModal = async (id) => {
        const isClinician = Auth.getUser()?.role === 'clinician';
        Modal.open({ title: 'Tashxisni tahrirlash', body: loadingHTML(), onConfirm: () => handleUpdate(id) });

        if (isClinician) {
            const dRes   = await Api.diagnoses.getOne(id);
            const patRes = await Api.patients.getOne(dRes.data.patient_id);
            Modal.setBody(formHTML(dRes.data, [], patRes.data.name));
        } else {
            const [dRes, patients] = await Promise.all([Api.diagnoses.getOne(id), fetchPatients()]);
            Modal.setBody(formHTML(dRes.data, patients));
        }
        renderIcons();
    };

    // ── Modal: O'chirishni tasdiqlash ─────────────────────────────────────

    const confirmDelete = (id, code) => {
        Modal.open({
            title:        'Tashxisni o\'chirish',
            body:         confirmHTML(`<strong>${escHtml(code)}</strong> tashxis yozuvini o'chirasizmi? Bu amalni qaytarib bo'lmaydi.`),
            confirmLabel: 'O\'chirish',
            confirmClass: 'btn-danger',
            onConfirm:    () => handleDelete(id),
        });
    };

    // ── CRUD ──────────────────────────────────────────────────────────────

    const handleCreate = async (patientId = null) => {
        const body = collectForm();
        if (!body) return;
        try {
            await Api.diagnoses.create(body);
            Modal.close();
            App.showAlert('Tashxis muvaffaqiyatli saqlandi.', 'success');
            if (patientId) {
                PatientProfile.render(patientId);
            } else {
                render();
            }
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
            App.showAlert('Tashxis yangilandi.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await Api.diagnoses.delete(id);
            Modal.close();
            App.showAlert('Tashxis o\'chirildi.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    // ── Forma yordamchilari ───────────────────────────────────────────────

    const fetchPatients = async () => {
        try { const r = await Api.patients.getAll(); return r.data; } catch { return []; }
    };

    const formHTML = (d = {}, patients = [], lockedPatientName = null) => `
        <div class="form-row">
            <div class="form-group">
                <label>ICD Kodi *</label>
                <input id="f-icd" type="text" value="${escHtml(d.icd_code || '')}" placeholder="Masalan: I21.0" />
            </div>
            <div class="form-group">
                <label>Darajasi *</label>
                <select id="f-severity">
                    <option value="">— tanlang —</option>
                    ${DARAJALAR.map(([val, label]) =>
                        `<option value="${val}" ${d.severity_level === val ? 'selected' : ''}>${label}</option>`
                    ).join('')}
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Tavsif *</label>
            <textarea id="f-desc" placeholder="Tashxisning klinik tavsifi…">${escHtml(d.description || '')}</textarea>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Bemor *</label>
                ${lockedPatientName
                    ? `<input type="text" value="${escHtml(lockedPatientName)}" disabled style="background:var(--color-bg-secondary);cursor:not-allowed" />
                       <input type="hidden" id="f-patient" value="${d.patient_id}" />`
                    : `<select id="f-patient">
                        <option value="">— bemorni tanlang —</option>
                        ${patients.map((p) => `<option value="${p.id}" ${Number(d.patient_id) === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`).join('')}
                       </select>`
                }
            </div>
            <div class="form-group">
                <label>Tashxis sanasi *</label>
                <input id="f-date" type="date" value="${d.diagnosed_at ? d.diagnosed_at.split('T')[0] : new Date().toISOString().split('T')[0]}" />
            </div>
        </div>
        <div class="form-group">
            <label>Klinik izohlar</label>
            <textarea id="f-notes" placeholder="Ixtiyoriy klinik izohlar…">${escHtml(d.notes || '')}</textarea>
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
            if (err) { err.textContent = 'ICD kodi, darajasi, tavsif va bemor kiritilishi shart.'; err.hidden = false; }
            return null;
        }
        return { icd_code, severity_level, description, patient_id: Number(patient_id), diagnosed_at, notes: notes || null };
    };

    return { render, openAddModal, openEditModal, confirmDelete };
})();
