import { loadBootstrapData } from './api.js';
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
        statusMsg.textContent = 'Cargando datos...';
        
        // Show loading
        const template = document.getElementById('loading-template');
        appContainer.appendChild(template.content.cloneNode(true));

        await loadBootstrapData();

        statusMsg.textContent = `Actualizado: ${new Date().toLocaleTimeString('es-ES')}`;
        
        setupNavigation();
        
        // Load initial view
        navigateTo('home');

    } catch (error) {
        console.error("Initialization error:", error);
        statusMsg.textContent = 'Error de conexión';
        statusMsg.style.color = 'var(--accent-danger)';
        
        empty(appContainer);
        const errTemplate = document.getElementById('error-template');
        const errNode = errTemplate.content.cloneNode(true);
        errNode.querySelector('.error-msg').textContent = error.message;
        appContainer.appendChild(errNode);
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

function navigateTo(viewName) {
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
