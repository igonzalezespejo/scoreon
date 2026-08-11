import { state } from '../state.js';
import { savePrediction, loadBootstrapLight, loadRankingsData } from '../api.js';
import { showToast } from '../utils/dom.js';
import { formatDate } from '../utils/dates.js';

export const bettingView = {
    render() {
        if (!state.coreLoaded) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title">Cargando datos de la porra...</h2>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">En unos segundos podrás ver tu apuesta.</p>
                </div>
            `;
        }

        if (state.coreError) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title" style="color: var(--accent-danger);">Error al cargar datos</h2>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">${state.coreError}</p>
                    <button class="btn btn-primary" style="margin-top: 1.5rem;" onclick="window.location.reload()">Recargar aplicación</button>
                </div>
            `;
        }

        if (!state.months || state.months.length === 0) {
            return `<div class="card"><p>No hay meses configurados.</p></div>`;
        }

        const selectedMonthObj = state.getSelectedMonthObj();
        if (!selectedMonthObj) {
            return `<div class="card"><p>Mes no encontrado.</p></div>`;
        }

        const monthOptionsHtml = state.months.map(m => {
            const title = m.title || m.month_id;
            return `<option value="${m.month_id}" ${m.month_id === state.selectedMonthId ? 'selected' : ''}>${title}</option>`;
        }).join('');

        return `
            <div class="card">
                <div style="margin-bottom: 1.5rem;">
                    <label class="form-label" for="betting-month-select" style="font-size: 0.9rem; color: var(--text-secondary);">Selecciona el mes:</label>
                    <select id="betting-month-select" class="form-select" style="max-width: 300px;">
                        ${monthOptionsHtml}
                    </select>
                </div>

                <h2 class="card-title">Tu apuesta para ${selectedMonthObj.title || selectedMonthObj.month_id}</h2>

                <div id="participant-status" style="margin-bottom: 1.5rem;"></div>

                <div id="matches-container">
                    <!-- Se rellena al instante desde la caché en memoria, sin llamada al servidor -->
                </div>

            </div>
        `;
    },

    mount(container) {
        const monthSelect = container.querySelector('#betting-month-select');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                state.setSelectedMonth(e.target.value);
                import('../app.js').then(app => app.navigateTo('betting'));
            });
        }

        this.showFromCache(container);
    },

    // Todos los meses (partidos, resultados, resumen) y las predicciones
    // propias del usuario ya llegaron enteros en el bootstrap/login inicial
    // (ver state.js), así que aquí no hay ninguna petición al servidor: es
    // una lectura pura de state.monthDataById / state.myPredictionsById.
    showFromCache(container) {
        const userId = state.currentUser.user_id;
        const monthId = state.selectedMonthId;

        const matchesContainer = container.querySelector('#matches-container');
        const statusContainer = container.querySelector('#participant-status');
        if (!matchesContainer || !statusContainer) return;

        const monthData = state.monthDataById[monthId];
        const summary = monthData ? (monthData.predictionsSummary[userId] || { status: 'pending' }) : { status: 'pending' };
        const canBet = state.canBet();

        let statusHtml = '';
        if (summary.status === 'submitted') {
            statusHtml = `<span class="badge badge-success">Apuesta completa ${summary.submitted_count || 0}/${summary.total_matches || 0}</span>`;
        } else if (summary.status === 'partial') {
            statusHtml = `<span class="badge badge-warning">Apuesta parcial ${summary.submitted_count || 0}/${summary.total_matches || 0}</span>`;
        } else {
            statusHtml = `<span class="badge badge-secondary">Sin apuesta</span>`;
        }

        if (!canBet) {
            statusHtml += `<div style="margin-top: 10px;"><span class="badge badge-danger">La porra está cerrada</span> <p class="text-muted" style="margin-top: 5px;">Puedes consultar tu apuesta, pero no modificarla.</p></div>`;
        }
        statusContainer.innerHTML = statusHtml;

        const matches = monthData ? monthData.matches : [];
        const results = monthData ? monthData.results : [];
        const userPredictions = state.getMyPredictionsForMonth(monthId);

        this.renderMatchesForm(userId, container, matches, results, userPredictions, summary);
    },

    renderMatchesForm(userId, container, matches, results, userPredictions, summary) {
        const matchesContainer = container.querySelector('#matches-container');
        const canBet = state.canBet();
        const hasSubmitted = summary.status !== 'pending';

        const sortedMatches = [...matches].sort((a, b) => a.display_order - b.display_order);
        let formHtml = `<form id="betting-form">`;

        const predMap = {};
        userPredictions.forEach(p => predMap[p.match_id] = p);

        const resultMap = {};
        results.forEach(r => resultMap[r.match_id] = r);

        sortedMatches.forEach(match => {
            const pred = predMap[match.match_id];
            const hg = pred && pred.home_goals !== undefined && pred.home_goals !== null ? pred.home_goals : '';
            const ag = pred && pred.away_goals !== undefined && pred.away_goals !== null ? pred.away_goals : '';

            const matchStatus = pred ? '<span class="badge badge-success" style="font-size: 0.7rem; padding: 2px 6px;">Guardado</span>' : '<span class="badge badge-secondary" style="font-size: 0.7rem; padding: 2px 6px;">Pendiente</span>';

            const realResult = resultMap[match.match_id];
            let realResultText = '- -';
            let realStatusBadge = '';
            if (realResult) {
                const statusLower = String(realResult.status || '').toLowerCase().trim();
                if (statusLower === 'cancelled' || statusLower === 'cancelado') {
                    realStatusBadge = `<span class="badge badge-danger" style="margin-left: 5px; font-size: 0.7rem; padding: 2px 4px;">Cancelado</span>`;
                } else if (statusLower === 'final') {
                    realStatusBadge = `<span class="badge badge-primary" style="margin-left: 5px; font-size: 0.7rem; padding: 2px 4px;">Final</span>`;
                    if (realResult.home_goals !== '' && realResult.away_goals !== '') {
                        realResultText = `${realResult.home_goals} - ${realResult.away_goals}`;
                    }
                } else {
                    if (realResult.home_goals !== '' && realResult.away_goals !== '') {
                        realResultText = `${realResult.home_goals} - ${realResult.away_goals}`;
                    }
                }
            }

            formHtml += `
                <div class="match-bet-row" style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center; border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                    <div class="match-info" style="margin-bottom: 0;">
                        <div class="match-meta" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span>${match.competition} - ${formatDate(match.kickoff_at)}</span>
                            ${matchStatus}
                        </div>
                        <div class="match-teams" style="font-size: 1.1rem;">${match.home_team} vs ${match.away_team}</div>
                    </div>

                    <div class="match-real-result" style="text-align: center; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color); padding: 0 1.5rem;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Resultado real${realStatusBadge}</div>
                        <div style="font-size: 1.5rem; font-weight: bold; margin-top: 5px; color: var(--text-color);">${realResultText}</div>
                    </div>

                    <div class="match-inputs" style="margin-top: 0; display: flex; flex-direction: column; align-items: center;">
                        <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; font-weight: 600;">Tu apuesta</div>
                        <div style="display: flex; align-items: center; justify-content: center;">
                            <input type="number" min="0" max="20" class="form-input goal-input" style="width: 50px; text-align: center; font-size: 1.2rem; padding: 0.5rem;" data-match="${match.match_id}" data-team="home" value="${hg}" ${!canBet ? 'disabled' : ''}>
                            <span class="divider" style="margin: 0 10px; font-weight: bold;">-</span>
                            <input type="number" min="0" max="20" class="form-input goal-input" style="width: 50px; text-align: center; font-size: 1.2rem; padding: 0.5rem;" data-match="${match.match_id}" data-team="away" value="${ag}" ${!canBet ? 'disabled' : ''}>
                        </div>
                    </div>
                </div>
            `;
        });

        if (canBet) {
            formHtml += `
                <div style="margin-top: 1.5rem; text-align: right;">
                    <button type="submit" class="btn btn-primary" id="btn-submit-bets">
                        ${hasSubmitted ? 'Actualizar Apuesta' : 'Guardar Apuesta'}
                    </button>
                </div>
            `;
        }
        formHtml += `</form>`;

        matchesContainer.innerHTML = formHtml;

        if (canBet) {
            const form = container.querySelector('#betting-form');
            form.addEventListener('submit', (e) => this.handleSubmit(e, userId, sortedMatches));
        }
    },

    async handleSubmit(e, userId, matches) {
        e.preventDefault();

        const btn = document.getElementById('btn-submit-bets');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        try {
            const predictions = [];
            matches.forEach(m => {
                const homeInput = document.querySelector(`input[data-match="${m.match_id}"][data-team="home"]`);
                const awayInput = document.querySelector(`input[data-match="${m.match_id}"][data-team="away"]`);
                if (homeInput.value !== '' && awayInput.value !== '') {
                    predictions.push({
                        match_id: m.match_id,
                        home_goals: parseInt(homeInput.value),
                        away_goals: parseInt(awayInput.value)
                    });
                }
            });

            const token = state.sessionToken;
            const monthId = state.selectedMonthId;

            const response = await savePrediction(userId, token, monthId, predictions);

            if (response.ok) {
                showToast(response.message || '¡Apuesta guardada correctamente!');

                // Actualiza la caché local al instante con lo que se acaba de
                // guardar (sabemos que el servidor lo aceptó), sin esperar a
                // una recarga completa para reflejarlo en pantalla.
                state.setMyPredictionsForMonth(monthId, predictions);

                // Refresca en segundo plano el resto de meses/resumen (por si
                // algo cambió en Sheets desde otra pestaña o el admin) y las
                // apuestas del ranking; no bloquea el repintado inmediato.
                loadBootstrapLight().catch(err => console.error("Error refrescando datos:", err));

                state.setRankingsLoading(true);
                loadRankingsData()
                    .then(data => state.updateRankings(data))
                    .catch(err => {
                        console.error("Error refreshing rankings:", err);
                        state.setRankingsError("Error al recargar rankings");
                    });

                const view = document.getElementById('view-betting');
                if (view) this.showFromCache(view);
            } else {
                showToast(response.message || 'Error de validación', 'error');
                btn.disabled = false;
                btn.textContent = 'Guardar Apuesta';
            }

        } catch (error) {
            showToast('Error de conexión o de servidor', 'error');
            btn.disabled = false;
            btn.textContent = 'Guardar Apuesta';
        }
    }
};
