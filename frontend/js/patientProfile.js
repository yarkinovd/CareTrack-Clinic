/**
 * js/patientProfile.js
 * Renders the Comprehensive Patient Profile view.
 *
 * Profile payload (from GET /api/patients/:id/profile):
 *   {
 *     patient:   { id, name, dob, phone, gender, registered_at }
 *     doctor:    { id, name, specialty, department, contact }
 *     diagnoses: [ { id, icd_code, description, severity_level, diagnosed_at, notes } … ]
 *   }
 */

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
                <!-- ── Patient header ────────────────────────────── -->
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1.5rem">
                    <div>
                        <h2 style="font-size:1.4rem;font-weight:700;display:flex;align-items:center;gap:.5rem">
                            ${escHtml(patient.name)}
                            ${patient.diagnosis_count > 0
                                ? `<span class="badge badge-diagnosed">Diagnosed</span>`
                                : `<span class="badge badge-pending">Pending</span>`}
                        </h2>
                        <p class="text-muted text-sm">Patient #${patient.id} · Registered ${formatDate(patient.registered_at)}</p>
                    </div>
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                        ${isPatient ? `
                            <button class="btn btn-primary" onclick="PatientProfile.openBookModal(${patient.id})">
                                <i data-feather="calendar"></i> Book Appointment
                            </button>
                        ` : ''}
                        ${canEditPatient ? `
                            <button class="btn btn-secondary" onclick="Patients.openEditModal(${patient.id})">
                                <i data-feather="edit-2"></i> Edit Patient
                            </button>
                        ` : ''}
                        ${canAddDiagnosis ? `
                            <button class="btn btn-primary" onclick="Diagnoses.openAddModal(${patient.id})">
                                <i data-feather="plus"></i> Add Diagnosis
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- ── Two-column info grid ───────────────────────── -->
                <div class="profile-grid">

                    <!-- Personal Information -->
                    <div class="profile-section">
                        <h4>Personal Information</h4>
                        <div class="profile-field">
                            <div class="field-label">Full Name</div>
                            <div class="field-value fw-600">${escHtml(patient.name)}</div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Date of Birth</div>
                            <div class="field-value">${formatDate(patient.dob)} <span class="text-muted text-sm">(Age ${calcAge(patient.dob)})</span></div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Gender</div>
                            <div class="field-value">${patient.gender}</div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Phone</div>
                            <div class="field-value">${escHtml(patient.phone || '—')}</div>
                        </div>
                    </div>

                    <!-- Assigned Doctor -->
                    <div class="profile-section">
                        <h4>Assigned Doctor</h4>
                        <div class="profile-field">
                            <div class="field-label">Name</div>
                            <div class="field-value fw-600">${escHtml(doctor.name)}</div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Specialty</div>
                            <div class="field-value">
                                <span class="badge badge-specialty">${doctor.specialty}</span>
                            </div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Department</div>
                            <div class="field-value">${escHtml(doctor.department)}</div>
                        </div>
                        ${doctor.contact ? `
                            <div class="profile-field">
                                <div class="field-label">Contact</div>
                                <div class="field-value text-sm">
                                    ${doctor.contact.phone ? `📞 ${escHtml(doctor.contact.phone)}<br/>` : ''}
                                    ${doctor.contact.email ? `✉ ${escHtml(doctor.contact.email)}<br/>` : ''}
                                    ${doctor.contact.office ? `🏥 ${escHtml(doctor.contact.office)}` : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- ── Appointments ──────────────────────────────── -->
                <div class="profile-diagnoses" style="margin-bottom:1.5rem">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
                        <h4 style="margin:0">Appointments
                            <span class="text-muted text-sm" style="font-weight:400;font-size:.8rem">
                                (${appointments.length} record${appointments.length !== 1 ? 's' : ''})
                            </span>
                        </h4>
                    </div>
                    ${appointments.length === 0
                        ? `<div class="empty-state"><p>No appointments booked yet.</p></div>`
                        : appointments.map((a) => `
                            <div class="diagnosis-card" style="align-items:center">
                                <div>
                                    <div class="desc">${escHtml(a.doctor_name)}
                                        <span class="badge badge-specialty" style="margin-left:.4rem;font-size:.65rem">${escHtml(a.specialty)}</span>
                                    </div>
                                    <div class="date">Booked: ${formatDate(a.booked_at)}</div>
                                    ${a.notes ? `<div class="notes">${escHtml(a.notes)}</div>` : ''}
                                </div>
                                <span class="badge ${a.status === 'pending' ? 'badge-pending' : 'badge-diagnosed'}">
                                    ${a.status === 'pending' ? 'Pending' : 'Completed'}
                                </span>
                            </div>
                        `).join('')
                    }
                </div>

                <!-- ── Diagnosis History ───────────────────────────── -->
                <div class="profile-diagnoses">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
                        <h4 style="margin:0">Diagnosis History
                            <span class="text-muted text-sm" style="font-weight:400;font-size:.8rem">
                                (${diagnoses.length} record${diagnoses.length !== 1 ? 's' : ''})
                            </span>
                        </h4>
                    </div>

                    ${diagnoses.length === 0
                        ? `<div class="empty-state"><p>No diagnosis records on file for this patient.</p></div>`
                        : diagnoses.map((d) => `
                            <div class="diagnosis-card">
                                <div>
                                    <div class="icd">${escHtml(d.icd_code)}</div>
                                    <div class="desc">${escHtml(d.description)}</div>
                                    <div class="date">Diagnosed: ${formatDate(d.diagnosed_at)}</div>
                                    ${d.notes ? `<div class="notes">${escHtml(d.notes)}</div>` : ''}
                                </div>
                                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.5rem">
                                    <span class="badge badge-${d.severity_level.toLowerCase()}">${d.severity_level}</span>
                                    ${canEditPatient ? `
                                        <div class="table-actions">
                                            <button class="btn btn-secondary btn-icon" title="Edit"
                                                onclick="Diagnoses.openEditModal(${d.id})">
                                                <i data-feather="edit-2"></i>
                                            </button>
                                            ${Auth.can('admin') ? `
                                                <button class="btn btn-danger btn-icon" title="Delete"
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
            title:     'Book New Appointment',
            body:      loadingHTML(),
            onConfirm: () => handleBook(patientId),
        });

        try {
            const res = await Api.doctors.getPublic();
            const options = res.data.map((d) =>
                `<option value="${d.id}">${escHtml(d.name)} (${d.specialty})</option>`
            ).join('');
            Modal.setBody(`
                <div class="form-group">
                    <label>Select Doctor *</label>
                    <select id="f-book-doctor">
                        <option value="">— select a doctor —</option>
                        ${options}
                    </select>
                </div>
                <div class="form-group">
                    <label>Notes (optional)</label>
                    <textarea id="f-book-notes" placeholder="Describe your symptoms or reason for visit…"></textarea>
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
            if (err) { err.textContent = 'Please select a doctor.'; err.hidden = false; }
            return;
        }

        try {
            await Api.appointments.create({ doctor_id: Number(doctor_id), notes: notes || null });
            Modal.close();
            App.showAlert('Appointment booked successfully.', 'success');
            render(patientId);
        } catch (err) {
            Modal.showError(err.message);
        }
    };

    return { render, openBookModal };
})();

// ── Small utility: calculate age from DOB string ──────────────────────────
function calcAge(dob) {
    if (!dob) return '?';
    const today    = new Date();
    const birth    = new Date(dob);
    let age        = today.getFullYear() - birth.getFullYear();
    const m        = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}
