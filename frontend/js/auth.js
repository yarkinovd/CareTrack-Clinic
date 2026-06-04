/**
 * js/auth.js
 * Authentication state management for the frontend SPA.
 *
 * Responsibilities:
 *   • Persist / retrieve JWT and user profile in localStorage.
 *   • Expose Auth.getUser() so other modules know the current role.
 *   • Role-gate helper: Auth.can(roles) → boolean.
 *   • Render the sidebar user chip and role badge.
 */

const Auth = (() => {
    const TOKEN_KEY = 'ct_token';
    const USER_KEY  = 'ct_user';

    // ── Getters ───────────────────────────────────────────────────────────

    const getToken = () => localStorage.getItem(TOKEN_KEY);

    const getUser = () => {
        const raw = localStorage.getItem(USER_KEY);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    };

    /** True if user has an unexpired token. */
    const isLoggedIn = () => {
        const token = getToken();
        if (!token) return false;
        try {
            // Decode JWT payload without verifying (signature verified server-side)
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 > Date.now();
        } catch {
            return false;
        }
    };

    /**
     * can(...roles)
     * Returns true if the current user's role is in the provided list.
     * Example: Auth.can('admin', 'clinician')
     */
    const can = (...roles) => {
        const user = getUser();
        return user ? roles.includes(user.role) : false;
    };

    // ── State Mutations ───────────────────────────────────────────────────

    const saveSession = (token, user) => {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    };

    const logout = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        // Redirect to login by showing the login screen
        document.getElementById('app').hidden          = true;
        document.getElementById('login-screen').hidden = false;
        document.getElementById('login-error').hidden  = true;
        document.getElementById('login-form').reset();
    };

    // ── UI Helpers ────────────────────────────────────────────────────────

    /** Update the sidebar user chip and topbar role badge. */
    const renderUserUI = () => {
        const user = getUser();
        if (!user) return;

        const chip = document.getElementById('user-chip');
        if (chip) {
            chip.innerHTML = `<strong>${user.username}</strong>${user.email || ''}`;
        }

        const badge = document.getElementById('role-badge');
        if (badge) {
            badge.textContent = user.role;
            badge.className   = `role-badge ${user.role}`;
        }
    };

    /**
     * applyRoleVisibility()
     * Hides any element with data-roles attribute if the current user's role
     * is not in the comma-separated list. Runs once after login.
     */
    const applyRoleVisibility = () => {
        document.querySelectorAll('[data-roles]').forEach((el) => {
            const allowed = el.dataset.roles.split(',').map((r) => r.trim());
            if (!can(...allowed)) {
                el.style.display = 'none';
            } else {
                el.style.removeProperty('display');
            }
        });
    };

    return { getToken, getUser, isLoggedIn, can, saveSession, logout, renderUserUI, applyRoleVisibility };
})();
