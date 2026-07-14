import { state } from './state.js';
import { USE_MOCK, API_URL } from './config.js';

/**
 * API layer
 */

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
            const response = await fetch(`${API_URL}?action=bootstrapLight&_=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            data = await response.json();
        }
        
        if (data.ok) {
            state.initializeLight(data);
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
            const response = await fetch(`${API_URL}?action=rankings&_=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            data = await response.json();
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
            const response = await fetch(`${API_URL}?action=bootstrap&_=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            data = await response.json();
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

export async function savePrediction(userId, pin, monthId, predictions) {
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
        const payload = {
            action: 'savePrediction',
            user_id: userId,
            pin: pin,
            month_id: monthId,
            predictions: predictions
        };
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.ok) {
            state.updatePredictionStatus(userId, 'submitted');
        }
        return result;
    }
}

export async function getUserPredictions(userId, pin, monthId) {
    if (USE_MOCK) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    if (!userId || !monthId) {
                        throw new Error("Datos inválidos");
                    }
                    if (state.config && state.config.pin_enabled && pin !== "1234") {
                        resolve({ ok: false, message: "PIN incorrecto" });
                        return;
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
        const payload = {
            action: 'getUserPredictions',
            user_id: userId,
            pin: pin,
            month_id: monthId
        };
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
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
                        }
                    });
                } catch (err) {
                    reject(err);
                }
            }, 800);
        });
    } else {
        const payload = {
            action: 'registerParticipant',
            display_name: displayName,
            email: email,
            registration_code: registrationCode
        };
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
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

    const payload = { action: 'adminGetMonths', admin_token: adminToken };
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    return await response.json();
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

    const payload = { action: 'adminGetMonthMatches', admin_token: adminToken, month_id: monthId };
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    return await response.json();
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

    const payload = { action: 'adminSaveResults', admin_token: adminToken, month_id: monthId, results: results };
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    return await response.json();
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

    const payload = { action: 'adminSetMonthStatus', admin_token: adminToken, month_id: monthId, status: status };
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    return await response.json();
}
