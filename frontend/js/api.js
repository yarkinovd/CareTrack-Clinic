/**
 * js/api.js
 * Centralised API service layer.
 *
 * All HTTP calls go through the `request()` helper so that:
 *   • The Authorization header is always attached from localStorage.
 *   • 401 responses auto-trigger logout (token expired / revoked).
 *   • Non-2xx responses throw a uniform Error with a .message from the server.
 *
 * Usage: const doctors = await Api.doctors.getAll({ search: 'Smith' });
 */

// The backend base URL. In production, change this to your Render service URL
// or set it dynamically if the frontend is served by the same Express server.
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : `${window.location.origin}/api`;

// ─── Core Request Helper ──────────────────────────────────────────────────

/**
 * request(endpoint, options)
 * Thin fetch wrapper. Returns parsed JSON body on success.
 * Throws Error with server's message on any non-2xx status.
 */
async function request(endpoint, options = {}) {
    const token = localStorage.getItem('ct_token');

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const config = {
        method: options.method || 'GET',
        headers,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    // Auto-logout on expired / invalid token
    if (response.status === 401) {
        Auth.logout();
        throw new Error('Session expired. Please log in again.');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
}

// ─── API Namespaces ───────────────────────────────────────────────────────

const Api = {
    // ── Authentication ────────────────────────────────────────────────────
    auth: {
        login:    (body) => request('/auth/login', { method: 'POST', body }),
        register: (body) => request('/auth/register', { method: 'POST', body }),
        me:       ()     => request('/auth/me'),
    },

    // ── Doctors ───────────────────────────────────────────────────────────
    doctors: {
        getAll:   (params = {}) => {
            const qs = new URLSearchParams(
                Object.fromEntries(Object.entries(params).filter(([, v]) => v))
            ).toString();
            return request(`/doctors${qs ? `?${qs}` : ''}`);
        },
        getOne:   (id)   => request(`/doctors/${id}`),
        create:   (body) => request('/doctors', { method: 'POST', body }),
        update:   (id, body) => request(`/doctors/${id}`, { method: 'PUT', body }),
        delete:   (id)   => request(`/doctors/${id}`, { method: 'DELETE' }),
    },

    // ── Patients ──────────────────────────────────────────────────────────
    patients: {
        getAll:     (params = {}) => {
            const qs = new URLSearchParams(
                Object.fromEntries(Object.entries(params).filter(([, v]) => v))
            ).toString();
            return request(`/patients${qs ? `?${qs}` : ''}`);
        },
        getOne:     (id)   => request(`/patients/${id}`),
        getProfile: (id)   => request(`/patients/${id}/profile`),
        create:     (body) => request('/patients', { method: 'POST', body }),
        update:     (id, body) => request(`/patients/${id}`, { method: 'PUT', body }),
        delete:     (id)   => request(`/patients/${id}`, { method: 'DELETE' }),
    },

    // ── Diagnoses ─────────────────────────────────────────────────────────
    diagnoses: {
        getAll:  (params = {}) => {
            const qs = new URLSearchParams(
                Object.fromEntries(Object.entries(params).filter(([, v]) => v))
            ).toString();
            return request(`/diagnoses${qs ? `?${qs}` : ''}`);
        },
        getOne:  (id)   => request(`/diagnoses/${id}`),
        create:  (body) => request('/diagnoses', { method: 'POST', body }),
        update:  (id, body) => request(`/diagnoses/${id}`, { method: 'PUT', body }),
        delete:  (id)   => request(`/diagnoses/${id}`, { method: 'DELETE' }),
    },
};
