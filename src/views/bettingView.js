import { state } from '../state.js';
import { savePrediction, loadBootstrapLight, loadRankingsData, registerParticipant, getUserPredictions } from '../api.js';
import { showToast, htmlToElements, empty } from '../utils/dom.js';
import { formatDate, getActiveMonthTitle } from '../utils/dates.js';

export const bettingView = {
    render() {
        if (!state.coreLoaded) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title">Cargando datos de la porra...</h2>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">En unos segundos podrás seleccionar tu nombre y apostar.</p>
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

        const participants = state.participants.filter(p => p.active);
        const optionsHtml = participants.map(p => `<option value="${p.user_id}">${p.display_name}</option>`).join('');
        
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
                
                <h2 class="card-title">Participar en ${selectedMonthObj.title || selectedMonthObj.month_id}</h2>
                
                <div class="form-group" style="max-width: 400px;">
                    <label class="form-label" for="participant-select">Selecciona tu nombre:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <select id="participant-select" class="form-select" style="flex: 1;">
                            <option value="">-- Elige un participante --</option>
                            ${optionsHtml}
                        </select>
                        <button id="btn-show-register" class="btn btn-secondary" style="white-space: nowrap; padding: 0.5rem 1rem;">Crear participante</button>
                    </div>
                </div>

                <div id="registration-form-container" class="card" style="display: none; background-color: var(--bg-dark); margin-top: 1rem; margin-bottom: 1.5rem;">
                    <h3 style="margin-top: 0; color: var(--accent-primary);">Registro de Participante</h3>
                    <form id="registration-form">
                        <div class="form-group">
                            <label class="form-label" for="reg-name">Nombre visible:</label>
                            <input type="text" id="reg-name" class="form-input" required minlength="2" maxlength="60" placeholder="Ej: Juan Pérez">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="reg-email">Email:</label>
                            <input type="email" id="reg-email" class="form-input" required placeholder="tu@email.com">
                        </div>
                        ${state.config && state.config.registration_code ? `
                        <div class="form-group">
                            <label class="form-label" for="reg-code">Código de invitación:</label>
                            <input type="text" id="reg-code" class="form-input" required>
                        </div>` : ''}
                        <div style="margin-top: 1.5rem;">
                            <button type="submit" class="btn btn-primary" id="btn-submit-register">Registrarse</button>
                            <button type="button" class="btn btn-secondary" id="btn-cancel-register" style="margin-left: 10px;">Cancelar</button>
                        </div>
                    </form>
                </div>

                <div id="participant-status" style="margin-bottom: 1.5rem;"></div>

                <div id="matches-container">
                    <!-- Matches will be loaded here when a participant is selected -->
                </div>

            </div>
        `;
    },

    mount(container) {
        const monthSelect = container.querySelector('#betting-month-select');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                const newMonthId = e.target.value;
                state.selectedMonthId = newMonthId;

                // Re-render immediately: month title, participant selector and
                // the "Crear participante" flow don't depend on per-month match
                // data. The actual match data is only fetched for real once the
                // user picks a participant and submits their PIN (see the
                // auth-form handler below); this is just a silent warm-up so
                // that fetch is instant by the time they get there.
                import('../app.js').then(app => app.navigateTo('betting'));
                this.prefetchMonthData(newMonthId);
            });
        }

        // Cover navigating here directly (nav bar) with a selectedMonthId that
        // was already changed from another view and isn't cached yet — warm
        // it up silently so the badge/PIN flow feels instant when reached.
        this.prefetchMonthData(state.selectedMonthId);

        const select = container.querySelector('#participant-select');
        select.addEventListener('change', (e) => {
            this.handleParticipantChange(e.target.value, container);
        });

        const btnShowRegister = container.querySelector('#btn-show-register');
        const regFormContainer = container.querySelector('#registration-form-container');
        const btnCancelRegister = container.querySelector('#btn-cancel-register');
        const regForm = container.querySelector('#registration-form');

        if (state.config && state.config.registration_enabled !== true) {
            btnShowRegister.style.display = 'none';
        } else {
            btnShowRegister.addEventListener('click', () => {
                regFormContainer.style.display = 'block';
                btnShowRegister.style.display = 'none';
                select.disabled = true;
            });
            
            btnCancelRegister.addEventListener('click', () => {
                regFormContainer.style.display = 'none';
                btnShowRegister.style.display = 'inline-block';
                select.disabled = false;
                regForm.reset();
            });

            regForm.addEventListener('submit', (e) => this.handleRegistration(e, container));
        }
    },

    async handleRegistration(e, container) {
        e.preventDefault();
        
        const btn = container.querySelector('#btn-submit-register');
        btn.disabled = true;
        btn.textContent = 'Registrando...';

        try {
            const name = container.querySelector('#reg-name').value;
            const email = container.querySelector('#reg-email').value;
            const codeInput = container.querySelector('#reg-code');
            const code = codeInput ? codeInput.value : '';

            const response = await registerParticipant(name, email, code);
            
            if (response.ok) {
                const pin = response.participant.pin;
                alert(`¡Participante creado!\n\nTu PIN de seguridad es: ${pin}\n\nGuarda este PIN, lo necesitarás para apostar.`);
                
                await loadBootstrapLight();
                
                const select = container.querySelector('#participant-select');
                const participants = state.participants.filter(p => p.active);
                select.innerHTML = `<option value="">-- Elige un participante --</option>` + 
                                   participants.map(p => `<option value="${p.user_id}">${p.display_name}</option>`).join('');
                select.value = response.participant.user_id;
                
                container.querySelector('#btn-cancel-register').click();
                
                this.handleParticipantChange(response.participant.user_id, container);
                
                setTimeout(() => {
                    const pinInput = container.querySelector('#pin-input');
                    if (pinInput) pinInput.value = pin;
                }, 100);

            } else {
                showToast(response.message || 'Error al registrar', 'error');
                btn.disabled = false;
                btn.textContent = 'Registrarse';
            }

        } catch (error) {
            showToast('Error de conexión o servidor', 'error');
            btn.disabled = false;
            btn.textContent = 'Registrarse';
        }
    },

    prefetchMonthData(monthId) {
        if (!monthId) return;

        // Always revalidate, even if this month is already cached: Sheets
        // can change from another tab/participant at any moment, so a stale
        // cache hit (e.g. from the initial page load) must not stay stuck
        // forever just because it's "not missing".
        import('../api.js').then(api => {
            api.loadMonthData(monthId).then(() => {
                if (state.selectedMonthId !== monthId) return;
                state.setSelectedMonth(monthId);

                const view = document.getElementById('view-betting');
                if (!view) return;
                const participantSelect = view.querySelector('#participant-select');
                const bettingForm = view.querySelector('#betting-form');
                // Only refresh the status badge silently if the user hasn't
                // already progressed past it (typing PIN/scores).
                if (participantSelect && participantSelect.value && !bettingForm) {
                    this.handleParticipantChange(participantSelect.value, view);
                }
            }).catch(() => {
                // Silent: the auth-form submit handler will retry
                // synchronously when the user actually needs the data.
            });
        });
    },

    handleParticipantChange(userId, container) {
        const matchesContainer = container.querySelector('#matches-container');
        const statusContainer = container.querySelector('#participant-status');
        
        empty(matchesContainer);
        empty(statusContainer);

        if (!userId) return;

        const monthData = state.monthDataById[state.selectedMonthId];
        const summary = monthData ? (monthData.predictionsSummary[userId] || { status: 'pending' }) : null;
        const canBet = state.canBet();

        let statusHtml = '';
        if (!summary) {
            // Month data for the currently selected month hasn't arrived yet
            // (background prefetch still in flight). Don't show a badge from a
            // different month — it'll be replaced silently once it lands, or
            // resolved for real when the user submits their PIN below.
            statusHtml = `<span class="badge badge-secondary">Comprobando estado...</span>`;
        } else if (summary.status === 'submitted') {
            statusHtml = `<span class="badge badge-success">Apuesta completa ${summary.submitted_count || 0}/${summary.total_matches || 0}</span>`;
        } else if (summary.status === 'partial') {
            statusHtml = `<span class="badge badge-warning">Apuesta parcial ${summary.submitted_count || 0}/${summary.total_matches || 0}</span>`;
        } else {
            statusHtml = `<span class="badge badge-secondary">Sin apuesta</span>`;
        }

        if (!canBet) {
            statusHtml += `<div style="margin-top: 10px;"><span class="badge badge-danger">La porra está cerrada</span> <p class="text-muted" style="margin-top: 5px;">Puedes consultar tu apuesta, pero no modificarla.</p></div>`;
        } else {
            statusHtml += `<p class="text-muted" style="margin-top: 5px;">Identifícate para ver o editar tu apuesta.</p>`;
        }
        statusContainer.innerHTML = statusHtml;

        let authHtml = `<form id="auth-form" style="margin-top: 1rem;">`;
        if (state.config && state.config.pin_enabled) {
            authHtml += `
                <div class="form-group" style="max-width: 200px;">
                    <label class="form-label" for="auth-pin-input">PIN de seguridad:</label>
                    <input type="password" id="auth-pin-input" class="form-input" required>
                </div>
            `;
        }
        authHtml += `
            <button type="submit" class="btn btn-primary" id="btn-auth-load">Cargar apuesta</button>
        </form>`;

        matchesContainer.innerHTML = authHtml;

        const authForm = container.querySelector('#auth-form');
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnLoad = document.getElementById('btn-auth-load');
            btnLoad.disabled = true;
            btnLoad.textContent = 'Cargando...';

            let pin = '';
            const pinInput = document.getElementById('auth-pin-input');
            if (pinInput) pin = pinInput.value;

            const monthId = state.selectedMonthId;

            try {
                // This is the point where match data for the selected month is
                // actually required, and where staleness matters most: refresh
                // it for real even if a background prefetch already cached it
                // earlier, since results/predictions in Sheets can have moved
                // on since then.
                const api = await import('../api.js');
                await api.loadMonthData(monthId);
                state.setSelectedMonth(monthId);

                const response = await getUserPredictions(userId, pin, monthId);
                if (response.ok) {
                    this.renderMatchesForm(userId, container, response.predictions, pin);
                } else {
                    showToast(response.message || 'Error al cargar apuestas', 'error');
                    btnLoad.disabled = false;
                    btnLoad.textContent = 'Cargar apuesta';
                }
            } catch (error) {
                showToast('Error de conexión', 'error');
                btnLoad.disabled = false;
                btnLoad.textContent = 'Cargar apuesta';
            }
        });
    },

    renderMatchesForm(userId, container, userPredictions, pin) {
        const matchesContainer = container.querySelector('#matches-container');
        const canBet = state.canBet();
        const summary = state.predictionsSummary[userId] || { status: 'pending' };
        const hasSubmitted = summary.status !== 'pending';

        const matches = state.getMatchesSorted();
        let formHtml = `<form id="betting-form">`;
        
        formHtml += `<input type="hidden" id="hidden-pin" value="${pin}">`;

        const predMap = {};
        userPredictions.forEach(p => predMap[p.match_id] = p);

        matches.forEach(match => {
            const pred = predMap[match.match_id];
            const hg = pred && pred.home_goals !== undefined && pred.home_goals !== null ? pred.home_goals : '';
            const ag = pred && pred.away_goals !== undefined && pred.away_goals !== null ? pred.away_goals : '';
            
            const matchStatus = pred ? '<span class="badge badge-success" style="font-size: 0.7rem; padding: 2px 6px;">Guardado</span>' : '<span class="badge badge-secondary" style="font-size: 0.7rem; padding: 2px 6px;">Pendiente</span>';

            const realResult = state.getResultForMatch(match.match_id);
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
            form.addEventListener('submit', (e) => this.handleSubmit(e, userId, matches));
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

            let pin = '';
            const hiddenPin = document.getElementById('hidden-pin');
            if (hiddenPin) pin = hiddenPin.value;

            const monthId = state.selectedMonthId;

            const response = await savePrediction(userId, pin, monthId, predictions);
            
            if (response.ok) {
                showToast(response.message || '¡Apuesta guardada correctamente!');
                await loadBootstrapLight();
                
                // Load rankings in background as ranking might be dirty
                state.setRankingsLoading(true);
                loadRankingsData()
                    .then(data => state.updateRankings(data))
                    .catch(err => {
                        console.error("Error refreshing rankings:", err);
                        state.setRankingsError("Error al recargar rankings");
                    });
                const container = document.getElementById('view-betting');
                const select = container.querySelector('#participant-select');
                if (select) select.value = userId;
                
                const predsResponse = await getUserPredictions(userId, pin, monthId);
                if (predsResponse.ok) {
                    this.handleParticipantChange(userId, container);
                    this.renderMatchesForm(userId, container, predsResponse.predictions, pin);
                } else {
                    this.handleParticipantChange(userId, container);
                }
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
