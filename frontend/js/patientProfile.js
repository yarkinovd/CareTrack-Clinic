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

            const { patient, doctor, diagnoses } = profile;
            const canClinician = Auth.can('admin', 'clinician');

            container.innerHTML = `
                <!-- ── Patient header ────────────────────────────── -->
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1.5rem">
                    <div>
                        <h2 style="font-size:1.4rem;font-weight:700">${escHtml(patient.name)}</h2>
                        <p class="text-muted text-sm">Patient #${patient.id} · Registered ${formatDate(patient.registered_at)}</p>
                    </div>
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                        ${canClinician ? `
                            <button class="btn btn-secondary" onclick="Patients.openEditModal(${patient.id})">
                                <i data-feather="edit-2"></i> Edit Patient
                            </button>
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
                                    ${canClinician ? `
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

    return { render };
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
