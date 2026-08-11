import { loadBootstrapLight, loadRankingsData, resumeSession, logout as logoutApi } from './api.js';
import { state } from './state.js';
import { homeView } from './views/homeView.js';
import { bettingView } from './views/bettingView.js';
import { rankingView } from './views/rankingView.js';
import { statusView } from './views/statusView.js';
import { adminView } from './views/adminView.js';
import { loginView } from './views/loginView.js';
import { empty, htmlToElement } from './utils/dom.js';

const VIEWS = {
    'login': loginView,
    'home': homeView,
    'betting': bettingView,
    'ranking': rankingView,
    'status': statusView,
    'admin': adminView
};

// Vistas cuyo contenido depende de state.coreLoaded/state.months/etc. y por
// tanto deben re-renderizarse cuando el bootstrap en segundo plano termina.
const CORE_DATA_VIEWS = ['login', 'home', 'betting', 'status', 'admin'];

let currentView = null;

async function init() {
    const statusMsg = document.getElementById('status-message');

    setupNavigation();
    setupLogout();
    updateNavVisibility();

    statusMsg.textContent = 'Cargando datos en segundo plano...';
    state.coreLoading = true;

    // La lista de participantes hace falta tanto para la pantalla de login
    // como para el resto de vistas, así que este fetch no espera a que se
    // resuelva la sesión.
    loadBootstrapLight()
        .then(data => {
            statusMsg.textContent = `Actualizado: ${new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })}`;

            const viewName = Object.keys(VIEWS).find(k => VIEWS[k] === currentView);
            if (viewName && CORE_DATA_VIEWS.includes(viewName)) {
                navigateTo(viewName);
            }

            state.setRankingsLoading(true);
            loadRankingsData()
                .then(rData => {
                    state.updateRankings(rData);
                    if (currentView && currentView === VIEWS['ranking']) {
                        navigateTo('ranking');
                    }
                })
                .catch(error => {
                    console.error("Error loading rankings:", error);
                    state.setRankingsError(error.message || "Error al cargar el ranking");
                    if (currentView && currentView === VIEWS['ranking']) {
                        navigateTo('ranking');
                    }
                });
        })
        .catch(error => {
            console.error("Error loading light data:", error);
            state.coreError = error.message || "Error al cargar datos básicos";
            state.coreLoading = false;
            statusMsg.textContent = 'Error cargando datos';
            statusMsg.style.color = 'var(--accent-danger)';

            const viewName = Object.keys(VIEWS).find(k => VIEWS[k] === currentView);
            if (viewName && CORE_DATA_VIEWS.includes(viewName)) {
                navigateTo(viewName);
            }
        });

    const token = state.restoreTokenFromStorage();
    if (!token) {
        navigateTo('login');
        return;
    }

    // Hay un token guardado de una visita anterior: lo confirmamos contra el
    // backend antes de dar acceso. Mientras se resuelve, la pantalla de login
    // muestra un estado de "verificando sesión" (state.sessionChecking).
    state.sessionChecking = true;
    navigateTo('login');

    try {
        const response = await resumeSession(token);
        if (response.ok) {
            state.setSession(token, response.user, response.myPredictions);
            state.sessionChecking = false;
            updateNavVisibility();
            navigateTo('home');
            return;
        }
    } catch (error) {
        console.error("Error resuming session:", error);
    }

    // Token caducado, revocado, o usuario desactivado/eliminado: se limpia y
    // se vuelve a pedir login.
    state.clearSession();
    state.sessionChecking = false;
    navigateTo('login');
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.btn-nav');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-target');
            if (target) {
                navigateTo(target);
            }
        });
    });
}

function setupLogout() {
    const btn = document.getElementById('btn-logout');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const token = state.sessionToken;
        state.clearSession();
        updateNavVisibility();
        navigateTo('login');

        try {
            await logoutApi(token);
        } catch (error) {
            // La sesión local ya está limpiada; si la fila en el backend no
            // se pudo borrar, caducará sola y no bloquea al usuario.
            console.error("Error cerrando sesión en el servidor:", error);
        }
    });
}

export function updateNavVisibility() {
    const navButtons = document.querySelector('.nav-buttons');
    const adminBtn = document.getElementById('btn-nav-admin');
    const userLabel = document.getElementById('current-user-label');

    const authed = state.isAuthenticated();
    if (navButtons) navButtons.style.display = authed ? '' : 'none';
    if (adminBtn) adminBtn.style.display = (authed && state.isAdmin()) ? '' : 'none';
    if (userLabel) {
        userLabel.textContent = authed && state.currentUser ? `Hola, ${state.currentUser.display_name}` : '';
    }
}

export function navigateTo(viewName) {
    const appContainer = document.getElementById('app-container');
    let resolvedName = viewName;
    let view = VIEWS[resolvedName];

    if (!view) return;

    // Guardián central: nadie navega a ninguna vista protegida sin sesión, y
    // solo el usuario marcado como is_admin puede entrar en Admin.
    if (resolvedName !== 'login' && !state.isAuthenticated()) {
        resolvedName = 'login';
        view = VIEWS[resolvedName];
    } else if (resolvedName === 'admin' && !state.isAdmin()) {
        resolvedName = 'home';
        view = VIEWS[resolvedName];
    }

    if (currentView && currentView.unmount) {
        currentView.unmount();
    }

    empty(appContainer);

    const viewElement = htmlToElement(`<div class="view-section active" id="view-${resolvedName}"></div>`);
    viewElement.innerHTML = view.render();
    appContainer.appendChild(viewElement);

    if (view.mount) {
        view.mount(viewElement);
    }

    currentView = view;

    document.querySelectorAll('.btn-nav').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-target') === resolvedName);
    });
}

// Start app
document.addEventListener('DOMContentLoaded', init);
