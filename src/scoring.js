import { validateGoals } from './utils/validation.js';

const DEFAULT_RULES = {
    exact_score: 20,
    correct_sign: 5,
    wrong: 0
};

/**
 * Gets the sign of a result.
 *  1: Home win
 * -1: Away win
 *  0: Draw
 */
function getSign(home, away) {
    if (home > away) return 1;
    if (home < away) return -1;
    return 0;
}

/**
 * Scores a single prediction against a real result.
 * @param {object} prediction - { home_goals, away_goals }
 * @param {object} result - { home_goals, away_goals, status }
 * @param {object} rules - Scoring rules (optional)
 * @returns {number|null} Score, or null if pending/invalid
 */
export function scorePrediction(prediction, result, rules = DEFAULT_RULES) {
    if (!prediction || prediction.home_goals === undefined || prediction.away_goals === undefined) {
        return null; 
    }

    if (!result || result.status !== 'finished') {
        return null; // pending
    }

    if (result.home_goals === undefined || result.away_goals === undefined) {
        return null;
    }

    const pH = Number(prediction.home_goals);
    const pA = Number(prediction.away_goals);
    const rH = Number(result.home_goals);
    const rA = Number(result.away_goals);

    if (!validateGoals(pH, pA)) return null;
    if (!validateGoals(rH, rA)) return null;

    if (pH === rH && pA === rA) {
        return rules.exact_score;
    }

    if (getSign(pH, pA) === getSign(rH, rA)) {
        return rules.correct_sign;
    }

    return rules.wrong;
}

/**
 * Wrapper for scoring a match prediction.
 */
export function scoreMatchPrediction(prediction, match, rules = DEFAULT_RULES) {
    if (!match) return null;
    // Assume match has result embedded or is the result object itself
    const result = {
        home_goals: match.home_goals,
        away_goals: match.away_goals,
        status: match.status
    };
    return scorePrediction(prediction, result, rules);
}

/**
 * Calculates the monthly ranking given all data.
 * @param {Array} participants 
 * @param {Array} matches 
 * @param {Array} predictions - Array of prediction objects { participant_id, match_id, home_goals, away_goals }
 * @param {Array} results - Optional array of match results. If omitted, results are extracted from matches.
 * @param {object} rules 
 */
export function calculateMonthlyRanking(participants, matches, predictions, results = null, rules = DEFAULT_RULES) {
    const rankingMap = {};

    participants.forEach(p => {
        rankingMap[p.user_id || p.id] = {
            participant: p,
            points: 0,
            exact_scores: 0,
            correct_signs: 0,
            failed: 0,
            played_matches: 0
        };
    });

    const resultMap = {};
    if (results && Array.isArray(results)) {
        results.forEach(r => resultMap[r.match_id || r.id] = r);
    } else {
        matches.forEach(m => resultMap[m.match_id || m.id] = m);
    }

    predictions.forEach(pred => {
        const participantId = pred.participant_id || pred.user_id;
        const matchId = pred.match_id;
        const result = resultMap[matchId];

        if (!result) return;
        const rankEntry = rankingMap[participantId];
        if (!rankEntry) return;

        const score = scorePrediction(pred, result, rules);
        if (score === null) return; // pending or invalid prediction

        rankEntry.played_matches += 1;
        rankEntry.points += score;

        if (score === rules.exact_score) {
            rankEntry.exact_scores += 1;
        } else if (score === rules.correct_sign) {
            rankEntry.correct_signs += 1;
        } else if (score === rules.wrong) {
            rankEntry.failed += 1;
        }
    });

    return Object.values(rankingMap).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.exact_scores !== a.exact_scores) return b.exact_scores - a.exact_scores;
        if (b.correct_signs !== a.correct_signs) return b.correct_signs - a.correct_signs;
        return b.failed - a.failed;
    });
}
