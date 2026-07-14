import { loadBootstrapLight, loadRankingsData } from './api.js';
import { state } from './state.js';
import { homeView } from './views/homeView.js';
import { bettingView } from './views/bettingView.js';
import { rankingView } from './views/rankingView.js';
import { statusView } from './views/statusView.js';
import { adminView } from './views/adminView.js';
import { empty, htmlToElement, showToast } from './utils/dom.js';

const VIEWS = {
    'home': homeView,
    'betting': bettingView,
    'ranking': rankingView,
    'status': statusView,
    'admin': adminView
};

let currentView = null;

async function init() {
    const statusMsg = document.getElementById('status-message');
    const appContainer = document.getElementById('app-container');

    try {
        statusMsg.textContent = 'Cargando datos en segundo plano...';
        
        setupNavigation();
        
        // Load initial view instantly
        navigateTo('home');
        
        state.coreLoading = true;
        loadBootstrapLight()
            .then(data => {
                statusMsg.textContent = `Actualizado: ${new Date().toLocaleTimeString('es-ES')}`;
                
                if (currentView && (currentView === VIEWS['betting'] || currentView === VIEWS['status'] || currentView === VIEWS['admin'] || currentView === VIEWS['home'])) {
                    const viewName = Object.keys(VIEWS).find(k => VIEWS[k] === currentView);
                    if (viewName) navigateTo(viewName);
                }

                state.setRankingsLoading(true);
                loadRankingsData()
                    .then(rData => {
                        state.updateRankings(rData);
                        if (currentView && currentView === VIEWS['ranking']) {
                            navigateTo('ranking'); // Re-render ranking view
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
                
                if (currentView && (currentView === VIEWS['betting'] || currentView === VIEWS['status'] || currentView === VIEWS['admin'])) {
                    const viewName = Object.keys(VIEWS).find(k => VIEWS[k] === currentView);
                    if (viewName) navigateTo(viewName);
                }
            });

    } catch (error) {
        console.error("Initialization error:", error);
        statusMsg.textContent = 'Error de inicialización local';
        statusMsg.style.color = 'var(--accent-danger)';
    }
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.btn-nav');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.getAttribute('data-target');
            if (target) {
                // Update active class
                navButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                navigateTo(target);
            }
        });
    });
}

export function navigateTo(viewName) {
    const appContainer = document.getElementById('app-container');
    const view = VIEWS[viewName];
    
    if (!view) return;

    // Clean up current view if it has an unmount method
    if (currentView && currentView.unmount) {
        currentView.unmount();
    }

    // Render new view
    empty(appContainer);
    
    const viewElement = htmlToElement(`<div class="view-section active" id="view-${viewName}"></div>`);
    viewElement.innerHTML = view.render();
    appContainer.appendChild(viewElement);

    // Call mount for events
    if (view.mount) {
        view.mount(viewElement);
    }

    currentView = view;
}

// Start app
document.addEventListener('DOMContentLoaded', init);
