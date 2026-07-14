/**
 * Global State Management
 */

class State {
    constructor() {
        this.config = null;
        this.activeMonth = null;
        this.participants = [];
        this.matches = [];
        this.predictionsSummary = {};
        this.rankingMonthly = [];
        this.rankingGlobal = [];
        this.results = [];
        this.serverTime = null;
        
        // Progressive Loading
        this.coreLoaded = false;
        this.coreLoading = false;
        this.coreError = null;
        
        this.rankingsLoaded = false;
        this.rankingsLoading = false;
        this.rankingsError = null;
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
        this.activeMonth = data.activeMonth;
        this.participants = data.participants || [];
        this.matches = data.matches || [];
        this.predictionsSummary = data.predictionsSummary || {};
        this.results = data.results || [];
        this.serverTime = data.serverTime;
        
        this.coreLoaded = true;
        this.coreLoading = false;
        this.coreError = null;
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
        if (!this.activeMonth) return false;
        if (this.activeMonth.status !== 'open') return false;
        
        // Verificar lock_at contra serverTime o fecha actual local
        const lockTime = new Date(this.activeMonth.lock_at).getTime();
        const now = this.serverTime ? new Date(this.serverTime).getTime() : Date.now();
        
        return now < lockTime;
    }
}

export const state = new State();
