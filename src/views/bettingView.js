import { state } from '../state.js';
import { savePrediction, loadBootstrapData, registerParticipant } from '../api.js';
import { showToast, htmlToElements, empty } from '../utils/dom.js';
import { formatDate } from '../utils/dates.js';

export const bettingView = {
    render() {
        if (!state.activeMonth) {
            return `<div class="card"><p>No hay mes activo configurado.</p></div>`;
        }

        const participants = state.participants.filter(p => p.active);
        const optionsHtml = participants.map(p => `<option value="${p.user_id}">${p.display_name}</option>`).join('');

        return `
            <div class="card">
                <h2 class="card-title">Participar en ${state.activeMonth.title}</h2>
                
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
            const codeInput = container.querySelector('#reg-code');
            const code = codeInput ? codeInput.value : '';

            const response = await registerParticipant(name, code);
            
            if (response.ok) {
                const pin = response.participant.pin;
                alert(`¡Participante creado!\n\nTu PIN de seguridad es: ${pin}\n\nGuarda este PIN, lo necesitarás para apostar.`);
                
                await loadBootstrapData();
                
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

    handleParticipantChange(userId, container) {
        const matchesContainer = container.querySelector('#matches-container');
        const statusContainer = container.querySelector('#participant-status');
        
        empty(matchesContainer);
        empty(statusContainer);

        if (!userId) return;

        const hasSubmitted = state.hasParticipantSubmitted(userId);
        const canBet = state.canBet();

        if (hasSubmitted) {
            statusContainer.innerHTML = `<span class="badge badge-success">Ya has enviado tu apuesta</span> <p class="text-muted" style="margin-top: 5px;">Podrás ver los resultados cuando comiencen los partidos.</p>`;
            if (!canBet) return; // If closed, just show status
        }

        if (!canBet) {
            statusContainer.innerHTML += `<div style="margin-top: 10px;"><span class="badge badge-danger">La porra está cerrada</span> <p class="text-muted" style="margin-top: 5px;">Ya no se admiten apuestas.</p></div>`;
        }

        // Render matches form
        const matches = state.getMatchesSorted();
        let formHtml = `<form id="betting-form">`;
        
        matches.forEach(match => {
            formHtml += `
                <div class="match-bet-row">
                    <div class="match-info">
                        <div class="match-meta">${match.competition} - ${formatDate(match.kickoff_at)}</div>
                        <div class="match-teams">${match.home_team} vs ${match.away_team}</div>
                    </div>
                    <div class="match-inputs">
                        <input type="number" min="0" max="20" class="form-input goal-input" data-match="${match.match_id}" data-team="home" required ${!canBet ? 'disabled' : ''}>
                        <span class="divider">-</span>
                        <input type="number" min="0" max="20" class="form-input goal-input" data-match="${match.match_id}" data-team="away" required ${!canBet ? 'disabled' : ''}>
                    </div>
                </div>
            `;
        });

        if (state.config && state.config.pin_enabled) {
            formHtml += `
                <div class="form-group" style="margin-top: 1.5rem; max-width: 200px;">
                    <label class="form-label" for="pin-input">PIN de seguridad:</label>
                    <input type="password" id="pin-input" class="form-input" required ${!canBet ? 'disabled' : ''}>
                </div>
            `;
        }

        formHtml += `
            <div style="margin-top: 1.5rem; text-align: right;">
                <button type="submit" class="btn btn-primary" id="btn-submit-bets" ${!canBet ? 'disabled' : ''}>
                    ${hasSubmitted ? 'Actualizar Apuesta' : 'Guardar Apuesta'}
                </button>
            </div>
        </form>`;

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
            const predictions = matches.map(m => {
                const homeInput = document.querySelector(`input[data-match="${m.match_id}"][data-team="home"]`);
                const awayInput = document.querySelector(`input[data-match="${m.match_id}"][data-team="away"]`);
                return {
                    match_id: m.match_id,
                    home_goals: parseInt(homeInput.value),
                    away_goals: parseInt(awayInput.value)
                };
            });

            let pin = '';
            const pinInput = document.getElementById('pin-input');
            if (pinInput) pin = pinInput.value;

            const monthId = state.activeMonth.month_id;

            const response = await savePrediction(userId, pin, monthId, predictions);
            
            if (response.ok) {
                showToast(response.message || '¡Apuesta guardada correctamente!');
                await loadBootstrapData();
                const container = document.getElementById('view-betting');
                // Mantener al usuario seleccionado
                const select = container.closest('.card').querySelector('#participant-select');
                if(select) select.value = userId;
                this.handleParticipantChange(userId, container.closest('.card'));
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
