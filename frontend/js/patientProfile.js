const PatientProfile = (() => {

    const render = async (patientId) => {
        const container = document.getElementById('patient-profile-content');
        container.innerHTML = loadingHTML();

        try {
            const res     = await Api.patients.getProfile(patientId);
            const profile = res.data;

            const { patient, doctor, diagnoses, appointments = [] } = profile;
            const canEditPatient  = Auth.can('admin', 'clinician');
            const canAddDiagnosis = Auth.can('admin', 'clinician');
            const isPatient       = Auth.can('patient');

            container.innerHTML = `
                <!-- ── Bemor sarlavhasi ──────────────────────────────── -->
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1.5rem">
                    <div>
                        <h2 style="font-size:1.4rem;font-weight:700;display:flex;align-items:center;gap:.5rem">
                            ${escHtml(patient.name)}
                            ${patient.diagnosis_count > 0
                                ? `<span class="badge badge-diagnosed">Tashxis qo'yilgan</span>`
                                : `<span class="badge badge-pending">Kutilmoqda</span>`}
                        </h2>
                        <p class="text-muted text-sm">Bemor #${patient.id} · Ro'yxatdan o'tgan: ${formatDate(patient.registered_at)}</p>
                    </div>
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                        ${isPatient ? `
                            <button class="btn btn-primary" onclick="PatientProfile.openBookModal(${patient.id})">
                                <i data-feather="calendar"></i> Qabulga yozilish
                            </button>
                        ` : ''}
                        ${canEditPatient ? `
                            <button class="btn btn-secondary" onclick="Patients.openEditModal(${patient.id})">
                                <i data-feather="edit-2"></i> Tahrirlash
                            </button>
                        ` : ''}
                        ${canAddDiagnosis ? `
                            <button class="btn btn-primary" onclick="Diagnoses.openAddModal(${patient.id})">
                                <i data-feather="plus"></i> Tashxis qo'yish
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- ── Ikki ustunli ma'lumot ─────────────────────────── -->
                <div class="profile-grid">

                    <!-- Shaxsiy ma'lumotlar -->
                    <div class="profile-section">
                        <h4>Shaxsiy ma'lumotlar</h4>
                        <div class="profile-field">
                            <div class="field-label">To'liq ism</div>
                            <div class="field-value fw-600">${escHtml(patient.name)}</div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Tug'ilgan sana</div>
                            <div class="field-value">${formatDate(patient.dob)} <span class="text-muted text-sm">(${calcAge(patient.dob)} yosh)</span></div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Jinsi</div>
                            <div class="field-value">${jinsNomi(patient.gender)}</div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Telefon</div>
                            <div class="field-value">${escHtml(patient.phone || '—')}</div>
                        </div>
                    </div>

                    <!-- Biriktirilgan shifokor -->
                    <div class="profile-section">
                        <h4>Biriktirilgan shifokor</h4>
                        ${doctor ? `
                        <div class="profile-field">
                            <div class="field-label">Ismi</div>
                            <div class="field-value fw-600">${escHtml(doctor.name)}</div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Mutaxassislik</div>
                            <div class="field-value">
                                <span class="badge badge-specialty">${mutaxassislikNomi(doctor.specialty)}</span>
                            </div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Bo'lim</div>
                            <div class="field-value">${escHtml(doctor.department)}</div>
                        </div>
                        ${doctor.contact ? `
                            <div class="profile-field">
                                <div class="field-label">Aloqa</div>
                                <div class="field-value text-sm">
                                    ${doctor.contact.phone ? `📞 ${escHtml(doctor.contact.phone)}<br/>` : ''}
                                    ${doctor.contact.email ? `✉ ${escHtml(doctor.contact.email)}<br/>` : ''}
                                    ${doctor.contact.office ? `🏥 ${escHtml(doctor.contact.office)}` : ''}
                                </div>
                            </div>
                        ` : ''}
                        ` : `<p class="text-muted text-sm">Shifokor biriktirilmagan</p>`}
                    </div>
                </div>

                <!-- ── Qabullar ──────────────────────────────────────── -->
                <div class="profile-diagnoses" style="margin-bottom:1.5rem">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
                        <h4 style="margin:0">Qabullar
                            <span class="text-muted text-sm" style="font-weight:400;font-size:.8rem">
                                (${appointments.length} ta yozuv)
                            </span>
                        </h4>
                    </div>
                    ${appointments.length === 0
                        ? `<div class="empty-state"><p>Hali qabulga yozilmagan.</p></div>`
                        : appointments.map((a) => `
                            <div class="diagnosis-card" style="align-items:center">
                                <div>
                                    <div class="desc">${escHtml(a.doctor_name)}
                                        <span class="badge badge-specialty" style="margin-left:.4rem;font-size:.65rem">${mutaxassislikNomi(a.specialty)}</span>
                                    </div>
                                    <div class="date">Yozilgan: ${formatDate(a.booked_at)}</div>
                                    ${a.notes ? `<div class="notes">${escHtml(a.notes)}</div>` : ''}
                                </div>
                                <span class="badge ${a.status === 'pending' ? 'badge-pending' : 'badge-diagnosed'}">
                                    ${a.status === 'pending' ? 'Kutilmoqda' : 'Yakunlangan'}
                                </span>
                            </div>
                        `).join('')
                    }
                </div>

                <!-- ── Tashxis tarixi ────────────────────────────────── -->
                <div class="profile-diagnoses">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
                        <h4 style="margin:0">Tashxis tarixi
                            <span class="text-muted text-sm" style="font-weight:400;font-size:.8rem">
                                (${diagnoses.length} ta yozuv)
                            </span>
                        </h4>
                    </div>

                    ${diagnoses.length === 0
                        ? `<div class="empty-state"><p>Bu bemor uchun tashxis yozuvlari mavjud emas.</p></div>`
                        : diagnoses.map((d) => `
                            <div class="diagnosis-card">
                                <div>
                                    <div class="icd">${escHtml(d.icd_code)}</div>
                                    <div class="desc">${escHtml(d.description)}</div>
                                    <div class="date">Tashxis qo'yilgan: ${formatDate(d.diagnosed_at)}</div>
                                    ${d.notes ? `<div class="notes">${escHtml(d.notes)}</div>` : ''}
                                </div>
                                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.5rem">
                                    <span class="badge badge-${d.severity_level.toLowerCase()}">${darajaNomi(d.severity_level)}</span>
                                    ${canEditPatient ? `
                                        <div class="table-actions">
                                            <button class="btn btn-secondary btn-icon" title="Tahrirlash"
                                                onclick="Diagnoses.openEditModal(${d.id})">
                                                <i data-feather="edit-2"></i>
                                            </button>
                                            ${Auth.can('admin') ? `
                                                <button class="btn btn-danger btn-icon" title="O'chirish"
                                                    onclick="Diagnoses.confirmDelete(${d.id}, '${escHtml(d.icd_code)}')">
                                                    <i data-feather="trash-2"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            `;
            renderIcons();
        } catch (err) {
            container.innerHTML = errorHTML(err.message);
        }
    };

    const openBookModal = async (patientId) => {
        Modal.open({
            title:     'Qabulga yozilish',
            body:      loadingHTML(),
            onConfirm: () => handleBook(patientId),
        });

        try {
            const res = await Api.doctors.getPublic();
            const options = res.data.map((d) =>
                `<option value="${d.id}">${escHtml(d.name)} (${mutaxassislikNomi(d.specialty)})</option>`
            ).join('');
            Modal.setBody(`
                <div class="form-group">
                    <label>Shifokorni tanlang *</label>
                    <select id="f-book-doctor">
                        <option value="">— shifokorni tanlang —</option>
                        ${options}
                    </select>
                </div>
                <div class="form-group">
                    <label>Izoh (ixtiyoriy)</label>
                    <textarea id="f-book-notes" placeholder="Shikoyatingiz yoki tashrif sababini yozing…"></textarea>
                </div>
                <div id="form-error" class="alert alert-error" hidden></div>
            `);
        } catch (err) {
            Modal.setBody(`<p class="alert alert-error">${escHtml(err.message)}</p>`);
        }
    };

    const handleBook = async (patientId) => {
        const doctor_id = document.getElementById('f-book-doctor')?.value;
        const notes     = document.getElementById('f-book-notes')?.value.trim();

        if (!doctor_id) {
            const err = document.getElementById('form-error');
            if (err) { err.textContent = 'Iltimos, shifokorni tanlang.'; err.hidden = false; }
            return;
        }

        try {
            await Api.appointments.create({ doctor_id: Number(doctor_id), notes: notes || null });
            Modal.close();
            App.showAlert('Qabulga muvaffaqiyatli yozildingiz.', 'success');
            render(patientId);
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    return { render, openBookModal };
})();

// ── Yosh hisoblash ────────────────────────────────────────────────────────
function calcAge(dob) {
    if (!dob) return '?';
    const today = new Date();
    const birth = new Date(dob);
    let age     = today.getFullYear() - birth.getFullYear();
    const m     = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

// ── Global yordamchilar (patients.js dan ham ishlatiladi) ─────────────────
function jinsNomi(val) {
    const map = { Male: 'Erkak', Female: 'Ayol', Other: 'Boshqa' };
    return map[val] || val;
}
function mutaxassislikNomi(val) {
    const map = {
        Cardiology:         'Kardiologiya',
        Neurology:          'Nevrologiya',
        Dermatology:        'Dermatologiya',
        Orthopedics:        'Ortopediya',
        'General Practice': 'Umumiy amaliyot',
    };
    return map[val] || val;
}
function darajaNomi(val) {
    const map = { Low: 'Engil', Medium: "O'rta", High: "Og'ir" };
    return map[val] || val;
}
