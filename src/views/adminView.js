import { state } from '../state.js';
import { adminGetMonths, adminGetMonthMatches, adminSaveResults, adminSetMonthStatus, loadRankingsData, loadBootstrapLight } from '../api.js';
import { showToast, htmlToElements, empty } from '../utils/dom.js';
import { formatDate } from '../utils/dates.js';

export const adminView = {
    adminToken: null,
    months: [],
    matches: [],
    results: [],

    render() {
        if (!this.adminToken) {
            return `
                <div class="card" style="text-align: center; padding: 4rem 2rem;">
                    <span style="font-size: 4rem; display: block; margin-bottom: 1rem;">⚙️</span>
                    <h2 style="color: var(--accent-secondary); margin-bottom: 1rem;">Panel de Administración</h2>
                    <form id="admin-login-form" style="max-width: 300px; margin: 0 auto;">
                        <div class="form-group">
                            <label class="form-label" for="admin-token-input">Código de administración:</label>
                            <input type="password" id="admin-token-input" class="form-input" required>
                        </div>
                        <button type="submit" class="btn btn-primary" id="btn-admin-login" style="width: 100%;">Entrar</button>
                    </form>
                </div>
            `;
        }

        const monthsHtml = this.months.map(m => `<option value="${m.month_id}">${m.title}</option>`).join('');

        return `
            <div class="card">
                <h2 class="card-title">⚙️ Administración</h2>
                
                <div class="form-group" style="max-width: 400px;">
                    <label class="form-label" for="admin-month-select">Seleccionar mes:</label>
                    <select id="admin-month-select" class="form-select">
                        <option value="">-- Elige un mes --</option>
                        ${monthsHtml}
                    </select>
                </div>

                <div id="admin-month-actions" style="display: none; margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-dark); border-radius: var(--border-radius);">
                    <h3 style="margin-top: 0; font-size: 1.1rem;">Estado del mes: <span id="admin-month-status-badge"></span></h3>
                    <div style="margin-top: 1rem; display: flex; gap: 10px;">
                        <button id="btn-admin-open" class="btn btn-primary">Abrir Porra</button>
                        <button id="btn-admin-lock" class="btn btn-secondary">Cerrar Porra</button>
                    </div>
                </div>

                <div id="admin-matches-container">
                    <!-- Matches will be loaded here -->
                </div>
            </div>
        `;
    },

    mount(container) {
        if (!this.adminToken) {
            const loginForm = container.querySelector('#admin-login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const btn = container.querySelector('#btn-admin-login');
                    btn.disabled = true;
                    btn.textContent = 'Verificando...';

                    const tokenInput = container.querySelector('#admin-token-input').value;
                    try {
                        const response = await adminGetMonths(tokenInput);
                        if (response.ok) {
                            this.adminToken = tokenInput;
                            this.months = response.months;
                            container.innerHTML = this.render();
                            this.mount(container);
                            
                            const select = container.querySelector('#admin-month-select');
                            if (response.active_month_id) {
                                select.value = response.active_month_id;
                                this.handleMonthChange(response.active_month_id, container);
                            }
                        } else {
                            showToast(response.message || 'Código incorrecto', 'error');
                            btn.disabled = false;
                            btn.textContent = 'Entrar';
                        }
                    } catch (err) {
                        showToast('Error de conexión', 'error');
                        btn.disabled = false;
                        btn.textContent = 'Entrar';
                    }
                });
            }
            return;
        }

        const select = container.querySelector('#admin-month-select');
        select.addEventListener('change', (e) => {
            this.handleMonthChange(e.target.value, container);
        });

        const btnOpen = container.querySelector('#btn-admin-open');
        const btnLock = container.querySelector('#btn-admin-lock');

        btnOpen.addEventListener('click', () => this.handleStatusChange('open', container));
        btnLock.addEventListener('click', () => this.handleStatusChange('locked', container));
    },

    async handleMonthChange(monthId, container) {
        const matchesContainer = container.querySelector('#admin-matches-container');
        const actionsContainer = container.querySelector('#admin-month-actions');
        
        empty(matchesContainer);
        if (!monthId) {
            actionsContainer.style.display = 'none';
            return;
        }

        const month = this.months.find(m => m.month_id === monthId);
        if (month) {
            actionsContainer.style.display = 'block';
            const badge = container.querySelector('#admin-month-status-badge');
            badge.textContent = month.status.toUpperCase();
            if (month.status === 'open') {
                badge.className = 'badge badge-success';
            } else {
                badge.className = 'badge badge-danger';
            }
        }

        matchesContainer.innerHTML = '<div style="text-align: center; padding: 2rem;">⏳ Cargando partidos...</div>';

        try {
            const response = await adminGetMonthMatches(this.adminToken, monthId);
            if (response.ok) {
                this.matches = response.matches;
                this.results = response.results || [];
                this.renderMatchesForm(monthId, container);
            } else {
                showToast(response.message || 'Error al cargar partidos', 'error');
                empty(matchesContainer);
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
            empty(matchesContainer);
        }
    },

    async handleStatusChange(status, container) {
        const monthId = container.querySelector('#admin-month-select').value;
        if (!monthId) return;

        try {
            const response = await adminSetMonthStatus(this.adminToken, monthId, status);
            if (response.ok) {
                showToast(response.message || `Estado actualizado a ${status}`);
                const month = this.months.find(m => m.month_id === monthId);
                if (month) month.status = status;
                
                const badge = container.querySelector('#admin-month-status-badge');
                badge.textContent = status.toUpperCase();
                badge.className = status === 'open' ? 'badge badge-success' : 'badge badge-danger';
                
                await loadBootstrapLight();
            } else {
                showToast(response.message || 'Error al actualizar', 'error');
            }
        } catch (err) {
            showToast('Error de conexión', 'error');
        }
    },

    renderMatchesForm(monthId, container) {
        const matchesContainer = container.querySelector('#admin-matches-container');
        
        let formHtml = `<form id="admin-results-form">`;
        
        const resultMap = {};
        this.results.forEach(r => resultMap[r.match_id] = r);

        this.matches.forEach(match => {
            const res = resultMap[match.match_id];
            const hg = res && res.home_goals !== undefined && res.home_goals !== null ? res.home_goals : '';
            const ag = res && res.away_goals !== undefined && res.away_goals !== null ? res.away_goals : '';
            const status = res && res.status ? res.status : 'pending';

            formHtml += `
                <div class="match-bet-row" style="background: var(--bg-dark);">
                    <div class="match-info">
                        <div class="match-meta">
                            <span>${match.competition} - ${formatDate(match.kickoff_at)}</span>
                        </div>
                        <div class="match-teams">${match.home_team} vs ${match.away_team}</div>
                    </div>
                    <div class="match-inputs" style="flex-wrap: wrap; gap: 10px; justify-content: flex-end;">
                        <input type="number" min="0" max="20" class="form-input goal-input" data-match="${match.match_id}" data-team="home" value="${hg}" placeholder="-" style="width: 60px;">
                        <span class="divider">-</span>
                        <input type="number" min="0" max="20" class="form-input goal-input" data-match="${match.match_id}" data-team="away" value="${ag}" placeholder="-" style="width: 60px;">
                        
                        <select class="form-select" data-match="${match.match_id}" data-field="status" style="width: 120px; padding: 0.3rem;">
                            <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="final" ${status === 'final' || status === 'finished' || status === 'finalized' ? 'selected' : ''}>Final</option>
                            <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </div>
                </div>
            `;
        });

        formHtml += `
            <div style="margin-top: 1.5rem; text-align: right;">
                <button type="submit" class="btn btn-primary" id="btn-admin-save">Guardar Resultados</button>
            </div>
        </form>`;

        matchesContainer.innerHTML = formHtml;

        const form = container.querySelector('#admin-results-form');
        form.addEventListener('submit', (e) => this.handleSubmitResults(e, monthId, container));
    },

    async handleSubmitResults(e, monthId, container) {
        e.preventDefault();
        
        const btn = document.getElementById('btn-admin-save');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        try {
            const resultsToSave = [];
            this.matches.forEach(m => {
                const homeInput = document.querySelector(`input[data-match="${m.match_id}"][data-team="home"]`);
                const awayInput = document.querySelector(`input[data-match="${m.match_id}"][data-team="away"]`);
                const statusSelect = document.querySelector(`select[data-match="${m.match_id}"][data-field="status"]`);
                
                resultsToSave.push({
                    match_id: m.match_id,
                    home_goals: homeInput.value,
                    away_goals: awayInput.value,
                    status: statusSelect.value
                });
            });

            const response = await adminSaveResults(this.adminToken, monthId, resultsToSave);
            
            if (response.ok) {
                showToast(response.message || 'Resultados guardados correctamente');
                
                state.setRankingsLoading(true);
                loadRankingsData()
                    .then(data => state.updateRankings(data))
                    .catch(err => {
                        console.error("Error refreshing rankings:", err);
                        state.setRankingsError("Error al recargar rankings");
                    });
                
                await loadBootstrapLight();
                
                this.handleMonthChange(monthId, container);
            } else {
                showToast(response.message || 'Error al guardar', 'error');
                btn.disabled = false;
                btn.textContent = 'Guardar Resultados';
            }

        } catch (error) {
            showToast('Error de conexión', 'error');
            btn.disabled = false;
            btn.textContent = 'Guardar Resultados';
        }
    }
};
