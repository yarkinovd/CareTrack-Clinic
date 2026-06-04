const Patients = (() => {

    // ── Ro'yxat ──────────────────────────────────────────────────────────

    const render = async (filters = {}) => {
        const container = document.getElementById('patients-table-container');
        container.innerHTML = loadingHTML();

        try {
            const res      = await Api.patients.getAll(filters);
            const patients = res.data;

            if (!patients.length) {
                container.innerHTML = emptyHTML('Bemorlar topilmadi.');
                return;
            }

            const canEdit   = Auth.can('admin', 'clinician');
            const canDelete = Auth.can('admin');

            const isClinician = Auth.getUser()?.role === 'clinician';
            const holatBelgi = (p) => {
                if (isClinician) {
                    return p.has_pending_appointment
                        ? `<span class="badge badge-pending">Kutilmoqda</span>`
                        : `<span class="badge badge-diagnosed">Tashxis qo'yilgan</span>`;
                }
                return Number(p.diagnosis_count) > 0
                    ? `<span class="badge badge-diagnosed">Tashxis qo'yilgan</span>`
                    : `<span class="badge badge-pending">Kutilmoqda</span>`;
            };

            container.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Ism</th>
                            <th>Holati</th>
                            <th class="hide-mobile">Jinsi</th>
                            <th class="hide-mobile">Biriktirilgan shifokor</th>
                            <th>Amallar</th>
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
                                <td>${holatBelgi(p)}</td>
                                <td class="hide-mobile">${jinsNomi(p.gender)}</td>
                                <td class="hide-mobile">
                                    <span class="text-sm">${escHtml(p.doctor_name || '—')}</span><br/>
                                    ${p.doctor_specialty ? `<span class="badge badge-specialty" style="font-size:.65rem">${mutaxassislikNomi(p.doctor_specialty)}</span>` : ''}
                                </td>
                                <td>
                                    <div class="table-actions">
                                        <button class="btn btn-secondary btn-icon" title="Profilni ko'rish"
                                            onclick="App.navigate('patient-profile', ${p.id})">
                                            <i data-feather="eye"></i>
                                        </button>
                                        ${canEdit ? `
                                            <button class="btn btn-secondary btn-icon" title="Tahrirlash"
                                                onclick="Patients.openEditModal(${p.id})">
                                                <i data-feather="edit-2"></i>
                                            </button>
                                        ` : ''}
                                        ${canDelete ? `
                                            <button class="btn btn-danger btn-icon" title="O'chirish"
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
            container.innerHTML = errorHTML(err.message || 'Bemorlarni yuklashda xatolik.');
        }
    };

    // ── Modal: Bemor qo'shish ─────────────────────────────────────────────

    const openAddModal = async () => {
        Modal.open({ title: 'Yangi bemor qo\'shish', body: loadingHTML(), onConfirm: handleCreate });
        const doctors = await fetchDoctors();
        Modal.setBody(formHTML({}, doctors));
        renderIcons();
    };

    // ── Modal: Bemorni tahrirlash ─────────────────────────────────────────

    const openEditModal = async (id) => {
        Modal.open({ title: 'Bemor ma\'lumotlarini tahrirlash', body: loadingHTML(), onConfirm: () => handleUpdate(id) });
        const isClinician = Auth.getUser()?.role === 'clinician';
        const [patRes, doctors] = await Promise.all([
            Api.patients.getOne(id),
            isClinician ? Promise.resolve([]) : fetchDoctors(),
        ]);
        Modal.setBody(formHTML(patRes.data, doctors, isClinician, true));
        renderIcons();
    };

    // ── Modal: O'chirishni tasdiqlash ─────────────────────────────────────

    const confirmDelete = (id, name) => {
        Modal.open({
            title:        'Bemorni o\'chirish',
            body:         confirmHTML(`<strong>${escHtml(name)}</strong> bemorni o'chirasizmi? Barcha tashxis yozuvlari ham o'chiriladi.`),
            confirmLabel: 'O\'chirish',
            confirmClass: 'btn-danger',
            onConfirm:    () => handleDelete(id),
        });
    };

    // ── CRUD ──────────────────────────────────────────────────────────────

    const handleCreate = async () => {
        const body = collectForm();
        if (!body) return;
        try {
            await Api.patients.create(body);
            Modal.close();
            App.showAlert('Bemor muvaffaqiyatli ro\'yxatga olindi.', 'success');
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
            App.showAlert('Bemor ma\'lumotlari yangilandi.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await Api.patients.delete(id);
            Modal.close();
            App.showAlert('Bemor o\'chirildi.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    // ── Forma yordamchilari ───────────────────────────────────────────────

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
            <label>To'liq ism *</label>
            <input id="f-name" type="text" value="${escHtml(p.name || '')}" placeholder="Masalan: Alisher Karimov" required />
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Tug'ilgan sana *</label>
                <input id="f-dob" type="date" value="${p.dob ? p.dob.split('T')[0] : ''}" required />
            </div>
            <div class="form-group">
                <label>Jinsi *</label>
                <select id="f-gender">
                    <option value="">— tanlang —</option>
                    <option value="Male"   ${p.gender === 'Male'   ? 'selected' : ''}>Erkak</option>
                    <option value="Female" ${p.gender === 'Female' ? 'selected' : ''}>Ayol</option>
                    <option value="Other"  ${p.gender === 'Other'  ? 'selected' : ''}>Boshqa</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Telefon</label>
                <input id="f-phone" type="text" value="${escHtml(p.phone || '')}" placeholder="+998-90-123-45-67" />
            </div>
            ${!isClinician ? `
            <div class="form-group">
                <label>Biriktirilgan shifokor *</label>
                <select id="f-doctor">
                    <option value="">— shifokorni tanlang —</option>
                    ${doctors.map((d) => `<option value="${d.id}" ${p.doctor_id === d.id ? 'selected' : ''}>${escHtml(d.name)} (${mutaxassislikNomi(d.specialty)})</option>`).join('')}
                </select>
            </div>
            ` : ''}
        </div>
        ${!isEdit ? `
        <hr style="margin:1rem 0;border:none;border-top:1px solid var(--color-border)" />
        <p style="font-size:.8rem;font-weight:600;color:var(--color-text-muted);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">Bemor Login Hisobi</p>
        <div class="form-row">
            <div class="form-group">
                <label>Foydalanuvchi nomi *</label>
                <input id="f-username" type="text" placeholder="Masalan: alisher_k" />
            </div>
            <div class="form-group">
                <label>Parol *</label>
                <input id="f-password" type="password" placeholder="Kamida 8 ta belgi" />
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
                    ? 'Ism, tug\'ilgan sana, jinsi va shifokor kiritilishi shart.'
                    : 'Ism, tug\'ilgan sana va jinsi kiritilishi shart.';
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
                if (err) { err.textContent = 'Foydalanuvchi nomi va parol kiritilishi shart.'; err.hidden = false; }
                return null;
            }
            body.username = username;
            body.password = password;
        }

        return body;
    };

    return { render, openAddModal, openEditModal, confirmDelete };
})();

// ── Yordamchi funksiyalar ──────────────────────────────────────────────────

function jinsNomi(val) {
    const map = { Male: 'Erkak', Female: 'Ayol', Other: 'Boshqa' };
    return map[val] || val;
}

function mutaxassislikNomi(val) {
    const map = {
        Cardiology:       'Kardiologiya',
        Neurology:        'Nevrologiya',
        Dermatology:      'Dermatologiya',
        Orthopedics:      'Ortopediya',
        'General Practice': 'Umumiy amaliyot',
    };
    return map[val] || val;
}
