/**
 * Global State Management
 */

const SESSION_STORAGE_KEY = 'porra_session_token';

class State {
    constructor() {
        this.currentUser = null; // { user_id, display_name, is_admin }
        this.sessionToken = null;
        this.sessionChecking = false;
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
        
        this.rankingsLoaded = false;
        this.rankingsLoading = false;
        this.rankingsError = null;
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
    }

    clearSession() {
        this.sessionToken = null;
        this.currentUser = null;
        this.myPredictionsById = {};
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }

    getMyPredictionsForMonth(monthId) {
        return this.myPredictionsById[monthId] || [];
    }

    // Actualiza en memoria las predicciones propias tras un guardado exitoso,
    // sin necesidad de volver a pedirlas al servidor.
    setMyPredictionsForMonth(monthId, predictions) {
        this.myPredictionsById[monthId] = predictions.map(p => ({
            match_id: p.match_id,
            home_goals: p.home_goals,
            away_goals: p.away_goals,
            submitted_at: new Date().toISOString()
        }));
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
        return month.status === 'open';
    }
}

export const state = new State();
