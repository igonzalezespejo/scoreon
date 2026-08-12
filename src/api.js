import { state } from './state.js';
import { USE_MOCK, API_URL } from './config.js';

/**
 * API layer
 */

// ==========================================
// TRANSPORTE
// ==========================================
//
// Apps Script no devuelve el resultado de /exec directamente: responde con un
// redirect 302 a una URL de un solo uso en script.googleusercontent.com, y el
// cliente tiene que ir a buscar ahí la respuesta ya calculada.
//
// Esa segunda fase falla de forma intermitente con 404 y a veces tarda decenas
// de segundos. Está medido (2026-08-12): ~31% de fallo en peticiones
// estrictamente secuenciales, y ocurre igual con una acción que no toca Google
// Sheets y devuelve 127 bytes que con bootstrapLight (51 KB). O sea: no es
// culpa del script, ni del tamaño de la respuesta, ni de la concurrencia, ni
// del navegador (curl lo reproduce igual). Es la infraestructura de Google.
//
// Consecuencia importante: cuando llega el 404, el backend YA se ha ejecutado.
// Reintentar vuelve a ejecutarlo. Por eso solo se reintenta lo que es seguro
// repetir — ver la nota de idempotencia en cada llamada.
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 600;
// OJO con bajar esto. Este backend responde despacio y de forma muy irregular:
// medido el 2026-08-12, la latencia mediana era ~21s y hubo respuestas BUENAS a
// los 62s. Un timeout corto (estuvo en 20s) aborta peticiones que iban a
// funcionar y convierte una espera larga en un error — es peor el remedio.
//
// Cortar pronto tampoco acelera la recuperación: los 404 llegan como respuesta
// HTTP, no como cuelgue, así que el reintento salta al instante sin esperar al
// timeout. Esto es solo una red de seguridad para conexiones muertas de verdad.
const REQUEST_TIMEOUT_MS = 90000;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOnce(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

// Reintenta la petición completa (no el redirect suelto: la URL intermedia es
// de un solo uso y no se puede volver a pedir).
async function apiRequest(url, options, attempts = MAX_ATTEMPTS) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await fetchOnce(url, options);
        } catch (error) {
            lastError = error;
            if (attempt < attempts) {
                console.warn(`Reintentando petición al backend (intento ${attempt}/${attempts} fallido):`, error.message);
                await wait(BASE_BACKOFF_MS * attempt + Math.random() * 400);
            }
        }
    }
    throw lastError;
}

function apiGet(action, params = {}, attempts = MAX_ATTEMPTS) {
    const query = new URLSearchParams({ action, ...params, _: String(Date.now()) });
    return apiRequest(`${API_URL}?${query}`, undefined, attempts);
}

function apiPost(payload, attempts = MAX_ATTEMPTS) {
    return apiRequest(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    }, attempts);
}

// Identificador único por intento de escritura. El backend lo usa para no
// repetir una operación que ya ejecutó cuando el 404 nos hizo creer que había
// fallado (ver getCachedIdempotentResponse en Code.gs).
function newRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function loadBootstrapLight() {
    try {
        let data;
        if (USE_MOCK) {
            const response = await fetch('./data/mock-bootstrap.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            data = await response.json();
            // Filtrar los rankings para simular el light
            delete data.rankingMonthly;
            delete data.rankingGlobal;
            data.message = "Light data loaded (mock)";
        } else {
            // Solo lectura: reintentar es seguro.
            data = await apiGet('bootstrapLight');
        }

        if (data.ok) {
            state.initializeLight(data);
            state.cacheBootstrapLight(data);
            return data;
        } else {
            throw new Error("Data was not ok");
        }
    } catch (error) {
        console.error("Error loading light data:", error);
        throw error;
    }
}

export async function loadRankingsData() {
    try {
        let data;
        if (USE_MOCK) {
            // Simulamos delay de red para que se note la carga en background
            await new Promise(resolve => setTimeout(resolve, 800));
            const response = await fetch('./data/mock-bootstrap.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const fullData = await response.json();
            data = {
                ok: true,
                rankingMonthly: fullData.rankingMonthly,
                rankingGlobal: fullData.rankingGlobal
            };
        } else {
            // Solo lectura (puede recalcular rankings en servidor, pero el
            // resultado es el mismo si se repite): reintentar es seguro.
            data = await apiGet('rankings');
        }

        if (data.ok) {
            return data;
        } else {
            throw new Error("Rankings data was not ok");
        }
    } catch (error) {
        console.error("Error loading rankings data:", error);
        throw error;
    }
}

export async function loadBootstrapData() {
    try {
        let data;
        if (USE_MOCK) {
            // En entorno local usando ES Modules y un servidor dev (ej. npx serve),
            // fetch a un archivo JSON local funciona.
            const response = await fetch('./data/mock-bootstrap.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            data = await response.json();
        } else {
            // Solo lectura: reintentar es seguro.
            data = await apiGet('bootstrap');
        }

        if (data.ok) {
            state.initialize(data);
            return data;
        } else {
            throw new Error("Data was not ok");
        }
    } catch (error) {
        console.error("Error loading data:", error);
        throw error;
    }
}

export async function loadMonthData(monthId) {
    try {
        let data;
        if (USE_MOCK) {
            await new Promise(resolve => setTimeout(resolve, 500));
            // Simulate month data using the bootstrap data
            const response = await fetch('./data/mock-bootstrap.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const fullData = await response.json();
            data = {
                ok: true,
                month: fullData.activeMonth,
                matches: fullData.matches,
                results: fullData.results,
                predictionsSummary: fullData.predictionsSummary
            };
        } else {
            // Solo lectura: reintentar es seguro.
            data = await apiGet('monthData', { month_id: monthId });
        }

        if (data.ok) {
            state.setMonthData(monthId, data);
            return data;
        } else {
            throw new Error(data.message || "Error cargando datos del mes");
        }
    } catch (error) {
        console.error("Error loading month data:", error);
        throw error;
    }
}

export async function savePrediction(userId, token, monthId, predictions) {
    if (USE_MOCK) {
        // Simulamos un delay de red
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    // Validación básica
                    if (!userId || !predictions || predictions.length === 0) {
                        throw new Error("Datos inválidos");
                    }

                    // Si llegamos aquí, simulamos éxito actualizando el estado local
                    state.updatePredictionStatus(userId, 'submitted');
                    resolve({ ok: true, message: "Apuesta guardada con éxito (Mock)" });
                } catch (err) {
                    reject(err);
                }
            }, 800);
        });
    } else {
        // Escritura idempotente por diseño: el backend reemplaza las filas del
        // usuario para esos partidos en vez de añadirlas (ver actionSavePrediction
        // en Code.gs), así que repetirla deja la hoja igual. Aun así se manda
        // request_id para que el backend devuelva la respuesta original en vez
        // de reejecutar cuando el 404 nos hizo reintentar de más.
        const result = await apiPost({
            action: 'savePrediction',
            token: token,
            month_id: monthId,
            predictions: predictions,
            request_id: newRequestId()
        });
        if (result.ok) {
            state.updatePredictionStatus(userId, 'submitted');
        }
        return result;
    }
}

export async function getUserPredictions(userId, token, monthId) {
    if (USE_MOCK) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    if (!userId || !monthId) {
                        throw new Error("Datos inválidos");
                    }

                    const predictions = [];
                    if (state.predictionsSummary[userId] && state.predictionsSummary[userId].status !== 'pending') {
                        const matches = state.getMatchesSorted();
                        if (matches.length > 0) {
                            predictions.push({
                                match_id: matches[0].match_id,
                                home_goals: 1,
                                away_goals: 0,
                                submitted_at: new Date().toISOString()
                            });
                        }
                    }
                    
                    resolve({
                        ok: true,
                        code: "USER_PREDICTIONS",
                        message: "Apuestas cargadas",
                        user_id: userId,
                        month_id: monthId,
                        predictions: predictions
                    });
                } catch (err) {
                    reject(err);
                }
            }, 500);
        });
    } else {
        // Solo lectura: reintentar es seguro.
        return await apiPost({
            action: 'getUserPredictions',
            token: token,
            month_id: monthId
        });
    }
}

export async function registerParticipant(displayName, email, registrationCode) {
    if (USE_MOCK) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    if (!displayName || displayName.trim().length < 2) {
                        resolve({ ok: false, message: "Nombre muy corto" });
                        return;
                    }
                    if (state.config.registration_enabled !== true) {
                        resolve({ ok: false, message: "Registro no habilitado" });
                        return;
                    }
                    if (state.config.registration_code && registrationCode !== state.config.registration_code) {
                        resolve({ ok: false, message: "Código de invitación incorrecto" });
                        return;
                    }
                    
                    const cleanName = displayName.trim();
                    const nameLower = cleanName.toLowerCase();
                    if (state.participants.some(p => p.display_name.toLowerCase() === nameLower)) {
                        resolve({ ok: false, message: "El nombre ya está en uso" });
                        return;
                    }

                    if (!email || typeof email !== 'string') {
                        resolve({ ok: false, message: "El email es obligatorio" });
                        return;
                    }
                    const cleanEmail = email.trim().toLowerCase();
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(cleanEmail)) {
                        resolve({ ok: false, message: "Formato de email inválido" });
                        return;
                    }
                    if (state.participants.some(p => p.email && p.email.trim().toLowerCase() === cleanEmail)) {
                        resolve({ ok: false, message: "El email ya está en uso" });
                        return;
                    }

                    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                    const pinLength = state.config.pin_length || 4;
                    const randomNumber = Math.floor(Math.random() * Math.pow(10, pinLength));
                    const mockPin = String(randomNumber).padStart(pinLength, "0");

                    // The backend won't push to local state until reload, but we return success
                    resolve({
                        ok: true,
                        code: "REGISTERED",
                        message: "Participante creado correctamente (Mock)",
                        participant: {
                            user_id: slug,
                            display_name: cleanName,
                            pin: mockPin,
                            active: true
                        },
                        token: 'mock-token-' + slug,
                        user: {
                            user_id: slug,
                            display_name: cleanName,
                            is_admin: false
                        }
                    });
                } catch (err) {
                    reject(err);
                }
            }, 800);
        });
    } else {
        // La única escritura que NO es idempotente por sí sola: repetirla
        // crearía un participante duplicado (o, peor, devolvería "nombre ya en
        // uso" dejando al usuario sin su PIN). El request_id es obligatorio
        // aquí: el backend cachea la respuesta y devuelve la misma —PIN y token
        // incluidos— si le llega dos veces el mismo id.
        return await apiPost({
            action: 'registerParticipant',
            display_name: displayName,
            email: email,
            registration_code: registrationCode,
            request_id: newRequestId()
        });
    }
}

// ==========================================
// SESSION / LOGIN
// ==========================================

export async function login(userId, pin) {
    if (USE_MOCK) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const participant = state.participants.find(p => p.user_id === userId);
                if (!participant) {
                    resolve({ ok: false, message: "Usuario no existe" });
                    return;
                }
                if (state.config && state.config.pin_enabled && pin !== "1234") {
                    resolve({ ok: false, message: "PIN incorrecto" });
                    return;
                }
                resolve({
                    ok: true,
                    code: "LOGIN_OK",
                    token: 'mock-token-' + userId,
                    user: {
                        user_id: participant.user_id,
                        display_name: participant.display_name,
                        is_admin: false
                    },
                    myPredictions: {}
                });
            }, 500);
        });
    }

    // Crea una fila en Sessions. Con request_id, un reintento devuelve el mismo
    // token en vez de abrir una segunda sesión huérfana.
    return await apiPost({
        action: 'login',
        user_id: userId,
        pin: pin,
        request_id: newRequestId()
    });
}

export async function resumeSession(token) {
    if (USE_MOCK) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (!token || !token.startsWith('mock-token-')) {
                    resolve({ ok: false, code: "SESSION_INVALID", message: "Sesión inválida" });
                    return;
                }
                const userId = token.replace('mock-token-', '');
                const participant = state.participants.find(p => p.user_id === userId);
                resolve({
                    ok: true,
                    code: "SESSION_OK",
                    user: {
                        user_id: userId,
                        display_name: participant ? participant.display_name : userId,
                        is_admin: false
                    },
                    myPredictions: {}
                });
            }, 300);
        });
    }

    // Idempotente: solo refresca la caducidad de la sesión.
    return await apiPost({ action: 'resumeSession', token: token });
}

export async function logout(token) {
    if (USE_MOCK) {
        return Promise.resolve({ ok: true, code: "LOGGED_OUT" });
    }

    // Idempotente: borrar una sesión ya borrada no cambia nada.
    return await apiPost({ action: 'logout', token: token });
}

// ==========================================
// ADMIN API
// ==========================================

export async function adminGetMonths(adminToken) {
    if (USE_MOCK) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (adminToken !== "admin") {
                    resolve({ ok: false, code: "UNAUTHORIZED", message: "Código admin incorrecto" });
                    return;
                }
                resolve({
                    ok: true,
                    months: [{ month_id: "2026-09", title: "Septiembre 2026", status: "open" }],
                    active_month_id: "2026-09"
                });
            }, 500);
        });
    }

    // Solo lectura: reintentar es seguro.
    return await apiPost({ action: 'adminGetMonths', admin_token: adminToken });
}

export async function adminGetMonthMatches(adminToken, monthId) {
    if (USE_MOCK) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (adminToken !== "admin") {
                    resolve({ ok: false, code: "UNAUTHORIZED", message: "Código admin incorrecto" });
                    return;
                }
                resolve({
                    ok: true,
                    matches: [
                        { match_id: "m001", month_id: monthId, home_team: "Real Madrid", away_team: "Barcelona", kickoff_at: "2026-09-15T21:00:00Z" }
                    ],
                    results: [
                        { match_id: "m001", home_goals: 1, away_goals: 1, status: "final" }
                    ]
                });
            }, 500);
        });
    }

    // Solo lectura: reintentar es seguro.
    return await apiPost({ action: 'adminGetMonthMatches', admin_token: adminToken, month_id: monthId });
}

export async function adminSaveResults(adminToken, monthId, results) {
    if (USE_MOCK) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (adminToken !== "admin") {
                    resolve({ ok: false, code: "UNAUTHORIZED", message: "Código admin incorrecto" });
                    return;
                }
                resolve({
                    ok: true,
                    message: `Se actualizaron ${results.length} resultados (Mock)`
                });
            }, 800);
        });
    }

    // Escritura idempotente: sobrescribe los resultados de esos partidos, no
    // los acumula. Aun así lleva request_id para no repetir el recálculo de
    // rankings si un 404 nos hace reintentar.
    return await apiPost({
        action: 'adminSaveResults',
        admin_token: adminToken,
        month_id: monthId,
        results: results,
        request_id: newRequestId()
    });
}

export async function adminSetMonthStatus(adminToken, monthId, status) {
    if (USE_MOCK) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (adminToken !== "admin") {
                    resolve({ ok: false, code: "UNAUTHORIZED", message: "Código admin incorrecto" });
                    return;
                }
                resolve({
                    ok: true,
                    message: `Mes ${monthId} actualizado a ${status} (Mock)`
                });
            }, 500);
        });
    }

    // Idempotente: dejar el mes en un estado concreto da igual repetirlo.
    return await apiPost({ action: 'adminSetMonthStatus', admin_token: adminToken, month_id: monthId, status: status });
}
