const Doctors = (() => {

    const MUTAXASSISLIKLAR = [
        ['Cardiology',       'Kardiologiya'],
        ['Neurology',        'Nevrologiya'],
        ['Dermatology',      'Dermatologiya'],
        ['Orthopedics',      'Ortopediya'],
        ['General Practice', 'Umumiy amaliyot'],
    ];

    const mutaxassislikNomi = (val) => {
        const t = MUTAXASSISLIKLAR.find(([v]) => v === val);
        return t ? t[1] : val;
    };

    // ── Ro'yxat ──────────────────────────────────────────────────────────

    const render = async (filters = {}) => {
        const container = document.getElementById('doctors-table-container');
        container.innerHTML = loadingHTML();

        try {
            const res = await Api.doctors.getAll(filters);
            const doctors = res.data;

            if (!doctors.length) {
                container.innerHTML = emptyHTML('Shifokorlar topilmadi.');
                return;
            }

            const isAdmin = Auth.can('admin');

            container.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Ism</th>
                            <th>Mutaxassislik</th>
                            <th class="hide-mobile">Bo'lim</th>
                            <th class="hide-mobile">Aloqa</th>
                            ${isAdmin ? '<th>Amallar</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${doctors.map((d) => `
                            <tr>
                                <td class="text-muted text-sm">${d.id}</td>
                                <td><span class="fw-600">${escHtml(d.name)}</span></td>
                                <td><span class="badge badge-specialty">${mutaxassislikNomi(d.specialty)}</span></td>
                                <td class="hide-mobile">${escHtml(d.department)}</td>
                                <td class="hide-mobile text-sm text-muted">
                                    ${d.contact_info?.phone || '—'}<br/>
                                    ${d.contact_info?.email || ''}
                                </td>
                                ${isAdmin ? `
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn btn-secondary btn-icon" title="Tahrirlash"
                                                onclick="Doctors.openEditModal(${d.id})">
                                                <i data-feather="edit-2"></i>
                                            </button>
                                            <button class="btn btn-danger btn-icon" title="O'chirish"
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
            container.innerHTML = errorHTML(err.message || 'Shifokorlarni yuklashda xatolik.');
        }
    };

    // ── Modal: Shifokor qo'shish ──────────────────────────────────────────

    const openAddModal = () => {
        Modal.open({
            title:     'Yangi shifokor qo\'shish',
            body:      formHTML(),
            onConfirm: handleCreate,
        });
    };

    // ── Modal: Shifokorni tahrirlash ──────────────────────────────────────

    const openEditModal = async (id) => {
        Modal.open({ title: 'Shifokorni tahrirlash', body: loadingHTML(), onConfirm: () => handleUpdate(id) });
        try {
            const res = await Api.doctors.getOne(id);
            Modal.setBody(formHTML(res.data, true));
            renderIcons();
        } catch (err) {
            Modal.setBody(errorHTML(err.message));
        }
    };

    // ── Modal: O'chirishni tasdiqlash ─────────────────────────────────────

    const confirmDelete = (id, name) => {
        Modal.open({
            title:        'Shifokorni o\'chirish',
            body:         confirmHTML(`<strong>${escHtml(name)}</strong> shifokorni o'chirasizmi? Login hisobi va barcha uchrashuvlar ham o'chiriladi. Biriktirilgan bemorlar biriktirilmagan holga o'tadi.`),
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
            await Api.doctors.create(body);
            Modal.close();
            App.showAlert('Shifokor muvaffaqiyatli qo\'shildi.', 'success');
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
            App.showAlert('Shifokor ma\'lumotlari yangilandi.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await Api.doctors.delete(id);
            Modal.close();
            App.showAlert('Shifokor o\'chirildi.', 'success');
            render();
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    // ── Forma ─────────────────────────────────────────────────────────────

    const formHTML = (d = {}, isEdit = false) => {
        const contact = d.contact_info || {};
        return `
            <div class="form-group">
                <label>To'liq ism *</label>
                <input id="f-name" type="text" value="${escHtml(d.name || '')}" placeholder="Masalan: Dr. Alisher Karimov" required />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Mutaxassislik *</label>
                    <select id="f-specialty">
                        ${MUTAXASSISLIKLAR.map(([val, label]) =>
                            `<option value="${val}" ${d.specialty === val ? 'selected' : ''}>${label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Bo'lim *</label>
                    <input id="f-department" type="text" value="${escHtml(d.department || '')}" placeholder="Masalan: Yurak-qon tomir bo'limi" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Telefon</label>
                    <input id="f-phone" type="text" value="${escHtml(contact.phone || '')}" placeholder="+998-90-123-45-67" />
                </div>
                <div class="form-group">
                    <label>Elektron pochta</label>
                    <input id="f-email" type="email" value="${escHtml(contact.email || '')}" placeholder="shifokor@klinika.uz" />
                </div>
            </div>
            <div class="form-group">
                <label>Xona / Joylashuv</label>
                <input id="f-office" type="text" value="${escHtml(contact.office || '')}" placeholder="A blok, 204-xona" />
            </div>
            ${!isEdit ? `
            <hr style="margin:1rem 0;border:none;border-top:1px solid var(--color-border)" />
            <p style="font-size:.8rem;font-weight:600;color:var(--color-text-muted);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">Login Hisobi</p>
            <div class="form-row">
                <div class="form-group">
                    <label>Foydalanuvchi nomi *</label>
                    <input id="f-username" type="text" placeholder="Masalan: dr_karimov" />
                </div>
                <div class="form-group">
                    <label>Parol *</label>
                    <input id="f-password" type="password" placeholder="Kamida 8 ta belgi" />
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
            if (err) { err.textContent = 'Ism, mutaxassislik va bo\'lim kiritilishi shart.'; err.hidden = false; }
            return null;
        }

        const body = { name, specialty, department, contact_info: { phone, email, office } };

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
