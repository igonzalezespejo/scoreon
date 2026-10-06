import { state } from '../state.js';
import { login, registerParticipant, refreshCoreData } from '../api.js';
import { showToast, empty } from '../utils/dom.js';

export const loginView = {
    render() {
        if (state.sessionChecking) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title">Verificando sesión...</h2>
                </div>
            `;
        }

        // No se ha podido verificar la sesión por un fallo de red. El token
        // sigue guardado y sigue siendo válido, así que no se pide el PIN otra
        // vez: basta con reintentar la comprobación.
        //
        // El segundo botón es imprescindible: sin él, con el backend fallando
        // de forma persistente el usuario se quedaba encerrado en esta pantalla
        // sin ninguna forma de llegar al formulario de login.
        if (state.sessionError && state.sessionToken) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title">No hemos podido entrar</h2>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">${state.sessionError}</p>
                    <p style="color: var(--text-secondary);">Tu sesión sigue guardada, no hace falta que vuelvas a meter el PIN.</p>
                    <button class="btn btn-primary" id="btn-retry-session" style="margin-top: 1.5rem;">Reintentar</button>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-secondary" id="btn-discard-session">Identificarme de otra forma</button>
                    </div>
                </div>
            `;
        }

        if (!state.coreLoaded) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title">Cargando...</h2>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">En unos segundos podrás identificarte.</p>
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

        const participants = state.participants.filter(p => p.active);
        const optionsHtml = participants.map(p => `<option value="${p.user_id}">${p.display_name}</option>`).join('');

        return `
            <div class="card" style="max-width: 460px; margin: 2rem auto;">
                <h2 class="card-title" style="text-align: center;">Identifícate</h2>
                <p class="text-muted" style="text-align: center; margin-bottom: 1.5rem;">Inicia sesión una vez y quedarás identificado en toda la web.</p>

                <form id="login-form">
                    <div class="form-group">
                        <label class="form-label" for="login-participant-select">Tu nombre:</label>
                        <select id="login-participant-select" class="form-select" required>
                            <option value="">-- Elige tu nombre --</option>
                            ${optionsHtml}
                        </select>
                    </div>
                    ${state.config && state.config.pin_enabled ? `
                    <div class="form-group">
                        <label class="form-label" for="login-pin-input">PIN de seguridad:</label>
                        <input type="password" id="login-pin-input" class="form-input" required>
                    </div>` : ''}
                    <button type="submit" class="btn btn-primary" id="btn-login-submit" style="width: 100%; margin-top: 0.5rem;">Entrar</button>
                </form>

                <div style="text-align: center; margin-top: 1.5rem;">
                    <button type="button" class="btn btn-secondary" id="btn-show-register">¿No estás en la lista? Crear participante</button>
                </div>

                <div id="registration-form-container" class="card" style="display: none; background-color: var(--bg-dark); margin-top: 1.5rem;">
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
                        ${state.config && (state.config.registration_code_required || state.config.registration_code) ? `
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
            </div>
        `;
    },

    mount(container) {
        if (state.sessionChecking) return;

        const btnRetrySession = container.querySelector('#btn-retry-session');
        if (btnRetrySession) {
            btnRetrySession.addEventListener('click', async () => {
                btnRetrySession.disabled = true;
                btnRetrySession.textContent = 'Reintentando...';
                const app = await import('../app.js');
                app.verifySession(state.sessionToken);
            });

            // Salida de emergencia: descarta la sesión guardada y lleva al
            // formulario normal, para no dejar a nadie encerrado aquí.
            const btnDiscard = container.querySelector('#btn-discard-session');
            if (btnDiscard) {
                btnDiscard.addEventListener('click', async () => {
                    state.clearSession();
                    const app = await import('../app.js');
                    app.updateNavVisibility();
                    app.navigateTo('login');
                });
            }
            return;
        }

        if (!state.coreLoaded || state.coreError) return;

        const loginForm = container.querySelector('#login-form');
        loginForm.addEventListener('submit', (e) => this.handleLogin(e, container));

        const btnShowRegister = container.querySelector('#btn-show-register');
        const regFormContainer = container.querySelector('#registration-form-container');
        const btnCancelRegister = container.querySelector('#btn-cancel-register');
        const regForm = container.querySelector('#registration-form');
        const participantSelect = container.querySelector('#login-participant-select');

        if (state.config && state.config.registration_enabled !== true) {
            btnShowRegister.style.display = 'none';
        } else {
            btnShowRegister.addEventListener('click', () => {
                regFormContainer.style.display = 'block';
                btnShowRegister.style.display = 'none';
                loginForm.style.display = 'none';
            });

            btnCancelRegister.addEventListener('click', () => {
                regFormContainer.style.display = 'none';
                btnShowRegister.style.display = 'inline-block';
                loginForm.style.display = 'block';
                regForm.reset();
            });

            regForm.addEventListener('submit', (e) => this.handleRegistration(e, container));
        }
    },

    async handleLogin(e, container) {
        e.preventDefault();

        const btn = container.querySelector('#btn-login-submit');
        btn.disabled = true;
        btn.textContent = 'Entrando...';

        try {
            const userId = container.querySelector('#login-participant-select').value;
            const pinInput = container.querySelector('#login-pin-input');
            const pin = pinInput ? pinInput.value : '';

            if (!userId) {
                showToast('Elige tu nombre', 'error');
                btn.disabled = false;
                btn.textContent = 'Entrar';
                return;
            }

            const response = await login(userId, pin);
            if (response.ok) {
                state.setSession(response.token, response.user, response.myPredictions);
                const app = await import('../app.js');
                app.updateNavVisibility();
                app.navigateTo('home');
            } else {
                showToast(response.message || 'PIN incorrecto', 'error');
                btn.disabled = false;
                btn.textContent = 'Entrar';
            }
        } catch (error) {
            showToast('Error de conexión', 'error');
            btn.disabled = false;
            btn.textContent = 'Entrar';
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
                alert(`¡Participante creado!\n\nTu PIN de seguridad es: ${pin}\n\nGuárdalo: lo necesitarás si inicias sesión desde otro dispositivo.`);

                state.setSession(response.token, response.user, response.myPredictions);
                const app = await import('../app.js');
                app.updateNavVisibility();
                app.navigateTo('home');

                // Refresco de la lista de participantes en segundo plano: si esta
                // llamada falla (p.ej. 404 transitorio de Apps Script) no debe
                // impedir que el usuario recién registrado entre en la app.
                refreshCoreData().catch(error => {
                    console.error('Error refrescando datos tras el registro:', error);
                });
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
    }
};
