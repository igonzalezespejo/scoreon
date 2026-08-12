import { state } from '../state.js';
import { savePrediction, loadBootstrapLight, loadRankingsData } from '../api.js';
import { showToast } from '../utils/dom.js';
import { formatDate, isMatchLocked } from '../utils/dates.js';
import { scorePrediction } from '../scoring.js';

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

        // Aunque la porra siga abierta, cada partido deja de admitir cambios en
        // cuanto llega su hora. Si ya no queda ninguno abierto no hay nada que
        // guardar, así que el botón sobra.
        const hasOpenMatches = sortedMatches.some(m => !isMatchLocked(m));

        let formHtml = `<form id="betting-form">`;

        const predMap = {};
        userPredictions.forEach(p => predMap[p.match_id] = p);

        const resultMap = {};
        results.forEach(r => resultMap[r.match_id] = r);

        formHtml += `<div class="betting-matches-grid">`;

        sortedMatches.forEach(match => {
            const isLocked = !canBet || isMatchLocked(match);
            const pred = predMap[match.match_id];
            const hg = pred && pred.home_goals !== undefined && pred.home_goals !== null ? pred.home_goals : '';
            const ag = pred && pred.away_goals !== undefined && pred.away_goals !== null ? pred.away_goals : '';
            const cardStateClass = pred ? 'is-saved' : 'is-pending';
            const ribbonText = pred ? 'Guardado' : 'Pendiente';

            const realResult = resultMap[match.match_id];
            let realHome = '–';
            let realAway = '–';
            let isCancelled = false;
            if (realResult) {
                const statusLower = String(realResult.status || '').toLowerCase().trim();
                isCancelled = statusLower === 'cancelled' || statusLower === 'cancelado';
                if (!isCancelled && realResult.home_goals !== '' && realResult.away_goals !== '') {
                    realHome = realResult.home_goals;
                    realAway = realResult.away_goals;
                }
            }

            const homeChip = isCancelled
                ? `<span class="betting-match-real-chip is-cancelled">Cancelado</span>`
                : `<span class="betting-match-real-chip tab-num">${realHome}</span>`;
            const awayChip = isCancelled
                ? `<span class="betting-match-real-chip is-cancelled">Cancelado</span>`
                : `<span class="betting-match-real-chip tab-num">${realAway}</span>`;

            // Solo hay puntos que mostrar si el partido ya tiene resultado
            // final: scorePrediction ya devuelve computable=false para
            // partidos pendientes/cancelados o sin apuesta guardada.
            const scoreResult = scorePrediction(pred, realResult, state.scoringRules);
            const pointsBadge = scoreResult.computable
                ? `<div class="betting-match-points-badge" title="Puntos conseguidos en este partido">+${scoreResult.points}</div>`
                : '';

            formHtml += `
                <div class="betting-match-card ${cardStateClass}">
                    ${pointsBadge}
                    <div class="betting-match-ribbon" title="${ribbonText === 'Guardado' ? 'Apuesta guardada' : 'Apuesta pendiente'}">${ribbonText}</div>
                    <div class="betting-match-comp-line"><span class="betting-match-comp">${match.competition}</span> · <span class="betting-match-horario">${formatDate(match.kickoff_at)}</span></div>
                    <div class="betting-match-split">
                        <div class="betting-match-team-name">${match.home_team}</div>
                        <div class="betting-match-team-name">${match.away_team}</div>
                        <div class="betting-match-results">
                            ${homeChip}
                            <input type="number" min="0" max="20" class="betting-match-bet-input" data-match="${match.match_id}" data-team="home" value="${hg}" ${isLocked ? 'disabled' : ''} aria-label="Tu apuesta, goles de ${match.home_team}">
                        </div>
                        <div class="betting-match-results">
                            ${awayChip}
                            <input type="number" min="0" max="20" class="betting-match-bet-input" data-match="${match.match_id}" data-team="away" value="${ag}" ${isLocked ? 'disabled' : ''} aria-label="Tu apuesta, goles de ${match.away_team}">
                        </div>
                    </div>
                </div>
            `;
        });

        formHtml += `</div>`;

        if (canBet && hasOpenMatches) {
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

        if (canBet && hasOpenMatches) {
            const form = container.querySelector('#betting-form');
            form.addEventListener('submit', (e) => this.handleSubmit(e, userId, sortedMatches));
        }
    },

    async handleSubmit(e, userId, matches) {
        e.preventDefault();

        const monthId = state.selectedMonthId;

        // Mapa de lo que ya se sabe guardado localmente, para no reenviar
        // partidos cuyo valor en pantalla coincide con lo ya guardado. El
        // backend es quien tiene la última palabra (ver actionSavePrediction
        // en Code.gs): esto es solo una optimización de envío, no la fuente
        // de verdad de qué es "un cambio".
        const existingByMatchId = {};
        state.getMyPredictionsForMonth(monthId).forEach(p => {
            existingByMatchId[p.match_id] = p;
        });

        // El bloqueo se recalcula aquí y no se reutiliza el del render: la
        // pestaña puede llevar horas abierta y haber vencido el plazo de
        // algún partido mientras tanto. Un input deshabilitado sigue
        // teniendo value legible, así que omitirlos es una decisión
        // explícita, no un efecto secundario del atributo disabled.
        const toSend = [];
        const lockedOut = [];
        matches.forEach(m => {
            const homeInput = document.querySelector(`input[data-match="${m.match_id}"][data-team="home"]`);
            const awayInput = document.querySelector(`input[data-match="${m.match_id}"][data-team="away"]`);
            if (homeInput.value === '' || awayInput.value === '') return;

            const enteredHome = parseInt(homeInput.value, 10);
            const enteredAway = parseInt(awayInput.value, 10);

            const existing = existingByMatchId[m.match_id];
            const hasChanged = !existing
                || Number(existing.home_goals) !== enteredHome
                || Number(existing.away_goals) !== enteredAway;

            if (!hasChanged) return;

            if (isMatchLocked(m)) {
                // Había un cambio real en pantalla, pero el partido venció
                // mientras tanto: se pierde, y hay que avisar de cuál es.
                lockedOut.push(m);
                return;
            }

            toSend.push({
                match_id: m.match_id,
                home_goals: enteredHome,
                away_goals: enteredAway
            });
        });

        if (toSend.length === 0 && lockedOut.length === 0) {
            // Nada distinto de lo ya guardado: ni falta llamar al backend.
            showToast('No hay cambios que guardar.');
            const view = document.getElementById('view-betting');
            if (view) this.showFromCache(view);
            return;
        }

        if (toSend.length === 0 && lockedOut.length > 0) {
            // Todo lo que cambió en pantalla pertenece a partidos que acaban
            // de vencer: no hay nada abierto que guardar, así que tampoco se
            // llama al backend (lo rechazaría por lote vacío).
            const names = lockedOut.map(m => `${m.home_team} - ${m.away_team}`).join(', ');
            showToast(`No se guardó nada: el plazo de ${names} ya había vencido.`, 'error');
            const view = document.getElementById('view-betting');
            if (view) this.showFromCache(view);
            return;
        }

        const btn = document.getElementById('btn-submit-bets');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        try {
            const token = state.sessionToken;

            const response = await savePrediction(userId, token, monthId, toSend);

            if (response.ok) {
                const noRealChanges = response.code === 'NO_CHANGES';

                if (lockedOut.length > 0) {
                    // Sin este aviso el usuario vería "guardado" y daría por
                    // hecho que también se guardó lo que tocó en un partido
                    // que ya había empezado.
                    const names = lockedOut.map(m => `${m.home_team} - ${m.away_team}`).join(', ');
                    const base = noRealChanges
                        ? 'No había más cambios que guardar.'
                        : (response.message || '¡Apuesta guardada correctamente!');
                    showToast(`${base} No se guardó ${names}: el plazo ya había vencido.`, 'error');
                } else if (noRealChanges) {
                    // Caso raro pero posible (otra pestaña ya guardó lo mismo
                    // entre medias): el backend es la autoridad y no encontró
                    // ningún cambio real, aunque este cliente creyera que sí.
                    showToast('No había cambios que guardar.');
                } else {
                    showToast(response.message || '¡Apuesta guardada correctamente!');
                }

                // Fusiona en la caché local lo que el backend confirma contra
                // Predictions_Current (confirmed_predictions), no `changes`:
                // aunque la respuesta sea NO_CHANGES, esta pestaña puede haber
                // enviado un valor que otra pestaña ya había guardado antes,
                // y su propia caché seguía con el valor previo a eso.
                state.setMyPredictionsForMonth(monthId, response.confirmed_predictions);

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
