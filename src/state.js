/**
 * Global State Management
 */

const SESSION_STORAGE_KEY = 'porra_session_token';

// Copia local de la última respuesta buena de bootstrapLight. Apps Script tarda
// entre 4 y 25 segundos en responder cuando responde, y falla con 404 ~1 de
// cada 3 veces, así que esperarlo antes de pintar nada dejaba al usuario
// mirando "Cargando..." un buen rato — o para siempre si el backend fallaba.
// Con esta copia la aplicación arranca al instante con los últimos datos
// conocidos y se refresca sola en cuanto llega la respuesta real.
const BOOTSTRAP_CACHE_KEY = 'porra_bootstrap_light';
const BOOTSTRAP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Usuario y apuestas propias de la última sesión confirmada. Permiten entrar
// al instante al volver (sesión optimista) y verificar el token en segundo
// plano. No es una autorización: el backend valida el token en cada
// escritura, así que un token caducado solo puede ver datos, nunca guardar.
const SESSION_USER_KEY = 'porra_session_user';
const MY_PREDICTIONS_KEY = 'porra_my_predictions';

function readJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // Almacenamiento lleno o bloqueado: solo se pierde la entrada rápida.
    }
}

function removeKey(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        // Sin almacenamiento no hay nada que borrar.
    }
}

class State {
    constructor() {
        this.currentUser = null; // { user_id, display_name, is_admin }
        this.sessionToken = null;
        this.sessionChecking = false;
        // Se rellena cuando no se ha podido *verificar* la sesión por un fallo
        // de red. No significa que la sesión sea inválida: el token se conserva
        // y la pantalla de login ofrece reintentar (ver verifySession en app.js).
        this.sessionError = null;
        this.myPredictionsById = {}; // { [month_id]: [{ match_id, home_goals, away_goals, submitted_at }] } — solo del usuario logueado

        this.config = null;
        this.activeMonth = null;
        this.participants = [];
        this.matches = [];
        this.predictionsSummary = {};
        this.rankingMonthly = [];
        this.rankingGlobal = [];
        this.results = [];
        this.months = [];
        this.selectedMonthId = null;
        this.monthDataById = {};
        this.scoringRules = {};
        
        this.serverTime = null;
        
        // Progressive Loading
        this.coreLoaded = false;
        this.coreLoading = false;
        this.coreError = null;
        // true mientras lo que se está enseñando viene de la copia local y no
        // de una respuesta fresca del backend.
        this.showingCachedData = false;
        
        this.rankingsLoaded = false;
        this.rankingsLoading = false;
        this.rankingsError = null;

        // Versión de la copia pública ya aplicada en esta visita (ver
        // acceptSnapshotVersion). No se guarda en el navegador a propósito.
        this.snapshotVersion = 0;
    }

    // Evita que una lectura lenta de la copia pública sustituya a otra más
    // nueva que llegó antes. Solo compara dentro de la misma visita: si se
    // comparara con la versión guardada en el navegador, reiniciar el
    // contador en el backend dejaría a la web ignorando los datos nuevos.
    acceptSnapshotVersion(version) {
        if (version == null) return true;
        if (version < this.snapshotVersion) return false;
        this.snapshotVersion = version;
        return true;
    }

    // Lee el token guardado en el navegador (si existe) a memoria, sin
    // validarlo contra el backend todavía. app.js decide si lo confirma
    // con resumeSession antes de dar por buena la sesión.
    restoreTokenFromStorage() {
        this.sessionToken = localStorage.getItem(SESSION_STORAGE_KEY);
        return this.sessionToken;
    }

    setSession(token, user, myPredictions) {
        this.sessionToken = token;
        this.currentUser = user;
        this.myPredictionsById = myPredictions || {};
        localStorage.setItem(SESSION_STORAGE_KEY, token);
        writeJson(SESSION_USER_KEY, user);
        writeJson(MY_PREDICTIONS_KEY, this.myPredictionsById);
    }

    // Sesión optimista: recupera el usuario y sus apuestas de la última
    // sesión confirmada para entrar sin esperar al backend. Devuelve false si
    // no hay copia (p. ej. la primera visita tras esta versión): entonces se
    // verifica como siempre, esperando a resumeSession.
    restoreCachedSession() {
        if (!this.sessionToken) return false;
        const user = readJson(SESSION_USER_KEY);
        if (!user || !user.user_id) return false;
        this.currentUser = user;
        this.myPredictionsById = readJson(MY_PREDICTIONS_KEY) || {};
        return true;
    }

    // Aplica lo que devuelve resumeSession en segundo plano. Devuelve true si
    // las apuestas propias han cambiado respecto a las que había en pantalla
    // (por ejemplo, se guardaron desde otro dispositivo).
    applyFreshSession(user, myPredictions) {
        const fresh = myPredictions || {};
        const changed = JSON.stringify(normalizePredictions(this.myPredictionsById)) !== JSON.stringify(normalizePredictions(fresh));
        this.currentUser = user;
        this.myPredictionsById = fresh;
        writeJson(SESSION_USER_KEY, user);
        writeJson(MY_PREDICTIONS_KEY, fresh);
        return changed;
    }

    clearSession() {
        this.sessionToken = null;
        this.currentUser = null;
        this.sessionError = null;
        this.myPredictionsById = {};
        localStorage.removeItem(SESSION_STORAGE_KEY);
        removeKey(SESSION_USER_KEY);
        removeKey(MY_PREDICTIONS_KEY);
    }

    getMyPredictionsForMonth(monthId) {
        return this.myPredictionsById[monthId] || [];
    }

    // Actualiza en memoria las predicciones propias tras un guardado, sin
    // esperar a volver a pedirlas al servidor.
    //
    // Recibe `confirmed_predictions`, no `changes`: el backend devuelve ahí el
    // estado YA confirmado contra Predictions_Current para cada partido del
    // envío, haya cambiado o no. Eso importa para el caso "otra pestaña ya
    // guardó justo el mismo valor que esta pestaña acaba de enviar" — el
    // backend responde NO_CHANGES (con `changes: []`), pero esta pestaña
    // seguía teniendo en caché el valor viejo de ANTES de que la otra pestaña
    // guardara. Si solo fusionáramos `changes` (vacío en ese caso), la caché
    // local se quedaría mostrando el valor viejo para siempre. Cada entrada
    // trae el `submitted_at` real de Sheets — nunca uno generado aquí.
    //
    // El resto de predicciones (partidos no incluidos en este envío) se
    // conservan tal cual estaban.
    setMyPredictionsForMonth(monthId, confirmedPredictions) {
        if (!confirmedPredictions || confirmedPredictions.length === 0) return;

        const byMatchId = {};

        (this.myPredictionsById[monthId] || []).forEach(p => {
            byMatchId[p.match_id] = p;
        });

        confirmedPredictions.forEach(p => {
            byMatchId[p.match_id] = {
                match_id: p.match_id,
                home_goals: p.home_goals,
                away_goals: p.away_goals,
                submitted_at: p.submitted_at
            };
        });

        this.myPredictionsById[monthId] = Object.values(byMatchId);
        writeJson(MY_PREDICTIONS_KEY, this.myPredictionsById);
    }

    isAuthenticated() {
        return !!(this.sessionToken && this.currentUser);
    }

    isAdmin() {
        return !!(this.currentUser && this.currentUser.is_admin);
    }

    initialize(data) {
        this.config = data.config;
        this.activeMonth = data.activeMonth;
        this.participants = data.participants || [];
        this.matches = data.matches || [];
        this.predictionsSummary = data.predictionsSummary || {};
        this.rankingMonthly = data.rankingMonthly || [];
        this.rankingGlobal = data.rankingGlobal || [];
        this.results = data.results || [];
        this.serverTime = data.serverTime;
        
        this.coreLoaded = true;
        this.coreLoading = false;
        this.coreError = null;
        
        this.rankingsLoaded = true;
        this.rankingsLoading = false;
        this.rankingsError = null;
    }

    initializeLight(data) {
        this.config = data.config;
        this.months = data.months || [];
        this.activeMonth = data.activeMonth;
        
        if (this.activeMonth && !this.selectedMonthId) {
            this.selectedMonthId = this.activeMonth.month_id;
        }

        this.participants = data.participants || [];
        this.matches = data.matches || [];
        this.predictionsSummary = data.predictionsSummary || {};
        this.results = data.results || [];
        this.serverTime = data.serverTime;
        this.scoringRules = data.scoringRules || {};

        // monthsData trae el detalle completo (partidos, resultados, resumen)
        // de TODOS los meses de una sola vez: se cachean todos aquí para que
        // Apuestas/Estado/Ranking naveguen entre meses sin volver a pedir
        // nada al servidor. Si el backend todavía no lo manda (versión vieja
        // desplegada), caemos al menos al mes activo como antes.
        if (data.monthsData) {
            Object.keys(data.monthsData).forEach(monthId => {
                const detail = data.monthsData[monthId];
                this.monthDataById[monthId] = {
                    month: (this.months || []).find(m => m.month_id === monthId) || null,
                    matches: detail.matches || [],
                    results: detail.results || [],
                    predictionsSummary: detail.predictionsSummary || {}
                };
            });
        } else if (this.selectedMonthId) {
            this.monthDataById[this.selectedMonthId] = {
                month: this.activeMonth,
                matches: this.matches,
                results: this.results,
                predictionsSummary: this.predictionsSummary
            };
        }

        this.coreLoaded = true;
        this.coreLoading = false;
        this.coreError = null;
        // hydrateFromCache() lo vuelve a poner a true después de llamar aquí.
        this.showingCachedData = false;
    }

    // Guarda la última respuesta buena de bootstrapLight para poder arrancar sin
    // esperar al backend en la siguiente visita.
    cacheBootstrapLight(data) {
        try {
            localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data: data }));
        } catch (e) {
            // localStorage lleno o deshabilitado. La caché es una mejora, no un
            // requisito: la aplicación sigue funcionando pidiendo los datos.
        }
    }

    // Pinta la aplicación con los últimos datos conocidos. Devuelve true si
    // había copia utilizable. El refresco real llega después por bootstrapLight.
    hydrateFromCache() {
        try {
            const raw = localStorage.getItem(BOOTSTRAP_CACHE_KEY);
            if (!raw) return false;

            const cached = JSON.parse(raw);
            if (!cached || !cached.data) return false;
            if (Date.now() - cached.cachedAt > BOOTSTRAP_CACHE_TTL_MS) return false;

            this.initializeLight(cached.data);
            // La copia pública trae también el ranking: así la pestaña de
            // ranking se ve al instante en vez de esperar a la red.
            if (cached.data.rankingMonthly) {
                this.updateRankings(cached.data);
            }
            this.showingCachedData = true;
            return true;
        } catch (e) {
            return false;
        }
    }

    setMonthData(monthId, data) {
        this.monthDataById[monthId] = {
            month: data.month,
            matches: data.matches || [],
            results: data.results || [],
            predictionsSummary: data.predictionsSummary || {}
        };
    }

    setSelectedMonth(monthId) {
        if (!monthId) return;
        this.selectedMonthId = monthId;
        const data = this.monthDataById[monthId];
        if (data) {
            this.matches = data.matches;
            this.results = data.results;
            this.predictionsSummary = data.predictionsSummary;
        }
    }

    getSelectedMonthObj() {
        return this.months.find(m => m.month_id === this.selectedMonthId) || this.activeMonth;
    }

    getSelectedMonthData() {
        return this.monthDataById[this.selectedMonthId] || null;
    }

    updateRankings(data) {
        this.rankingMonthly = data.rankingMonthly || [];
        this.rankingGlobal = data.rankingGlobal || [];
        this.rankingsLoaded = true;
        this.rankingsLoading = false;
        this.rankingsError = null;
    }

    setRankingsLoading(isLoading) {
        this.rankingsLoading = isLoading;
    }

    setRankingsError(error) {
        this.rankingsError = error;
        this.rankingsLoading = false;
    }

    getParticipant(userId) {
        return this.participants.find(p => p.user_id === userId);
    }

    getResultForMatch(matchId) {
        return this.results.find(r => r.match_id === matchId) || null;
    }

    getMatchesSorted() {
        return [...this.matches].sort((a, b) => a.display_order - b.display_order);
    }

    hasParticipantSubmitted(userId) {
        const summary = this.predictionsSummary[userId];
        return summary && summary.status === 'submitted';
    }

    updatePredictionStatus(userId, status) {
        this.predictionsSummary[userId] = {
            status: status,
            submitted_at: new Date().toISOString()
        };
    }
    
    canBet() {
        const month = this.getSelectedMonthObj();
        if (!month) return false;

        // status es la única autoridad (la controla el admin con
        // Abrir/Cerrar Porra). El backend cierra automáticamente un mes
        // "open" cuyo lock_at ya pasó (ver autoCloseExpiredMonths en
        // Code.gs), pero es de un solo disparo: si el admin lo reabre a
        // mano después de esa fecha, se queda abierto — por eso aquí no
        // se vuelve a comprobar lock_at, solo status.
        //
        // Excepción: un mes "open" con lock_at vencido y SIN auto_closed_at
        // es uno que el backend todavía no ha cerrado, pero cerrará en cuanto
        // llegue cualquier escritura (actionSavePrediction lo cierra antes de
        // validar). Antes lo cerraba la propia carga de la web; con la copia
        // pública el cierre puede tardar unos minutos en aparecer, así que
        // aquí se aplica la misma regla para no ofrecer un formulario que el
        // servidor va a rechazar. Si el admin lo reabrió a mano, ya tiene
        // auto_closed_at y sigue abierto.
        if (month.status !== 'open') return false;
        if (month.lock_at && !month.auto_closed_at) {
            const lockTime = new Date(month.lock_at).getTime();
            if (!isNaN(lockTime) && Date.now() >= lockTime) return false;
        }
        return true;
    }
}

// Forma comparable de { month_id: [predicciones] }: mismo orden y mismos
// tipos, para detectar cambios reales sin falsos positivos por orden o por
// "2" vs 2.
function normalizePredictions(byMonth) {
    const out = {};
    Object.keys(byMonth || {}).sort().forEach(monthId => {
        out[monthId] = (byMonth[monthId] || [])
            .map(p => [String(p.match_id), Number(p.home_goals), Number(p.away_goals)])
            .sort((a, b) => a[0].localeCompare(b[0]));
    });
    return out;
}

export const state = new State();
