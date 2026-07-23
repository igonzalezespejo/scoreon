import { validateGoals } from './utils/validation.js';

const DEFAULT_RULES = {
    sign: 4,
    home_goals: 2,
    away_goals: 2,
    exact_bonus: 2
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
 * @returns {object} { rule_id, points, computable }
 */
export function scorePrediction(prediction, result, rules = DEFAULT_RULES) {
    if (!prediction || prediction.home_goals === undefined || prediction.away_goals === undefined) {
        return { rule_id: 'pending', points: 0, computable: false };
    }

    if (!result || (result.status !== 'finished' && result.status !== 'final')) {
        return { rule_id: 'pending', points: 0, computable: false };
    }

    if (result.home_goals === undefined || result.away_goals === undefined) {
        return { rule_id: 'pending', points: 0, computable: false };
    }

    const pH = Number(prediction.home_goals);
    const pA = Number(prediction.away_goals);
    const rH = Number(result.home_goals);
    const rA = Number(result.away_goals);

    if (!validateGoals(pH, pA)) return { rule_id: 'pending', points: 0, computable: false };
    if (!validateGoals(rH, rA)) return { rule_id: 'pending', points: 0, computable: false };

    const isDraw = (rH === rA);
    const isExact = (pH === rH && pA === rA);
    const correctSign = getSign(pH, pA) === getSign(rH, rA);
    const correctHome = (pH === rH);
    const correctAway = (pA === rA);

    const getPoint = (id) => rules[id] !== undefined ? Number(rules[id]) : DEFAULT_RULES[id];

    let points = 0;
    if (correctSign) points += getPoint('sign');
    if (correctHome) points += getPoint('home_goals');
    if (correctAway) points += getPoint('away_goals');
    if (isExact) points += getPoint('exact_bonus');

    let rule_id = 'wrong';

    if (isExact) {
        rule_id = isDraw ? 'exact_draw' : 'exact_non_draw';
    } else if (correctSign) {
        rule_id = isDraw ? 'draw_not_exact' : 'winner_not_exact';
    } else if (correctHome || correctAway) {
        rule_id = 'partial_goals';
    }

    return { rule_id, points, computable: true };
}

/**
 * Wrapper for scoring a match prediction.
 */
export function scoreMatchPrediction(prediction, match, rules = DEFAULT_RULES) {
    if (!match) return { rule_id: 'pending', points: 0, computable: false };
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
 * @param {Array} predictions - Array of prediction objects
 * @param {Array} results - Optional array of match results. If omitted, results are extracted from matches.
 * @param {object} rules 
 */
export function calculateMonthlyRanking(participants, matches, predictions, results = null, rules = DEFAULT_RULES) {
    const rankingMap = {};

    participants.forEach(p => {
        if (p.active) {
            rankingMap[p.user_id || p.id] = {
                user_id: p.user_id || p.id,
                display_name: p.display_name,
                points: 0,
                exact_scores: 0,
                correct_signs: 0,
                failed: 0,
                played_matches: 0,
                participant: p // keep for potential legacy use, though rankingView doesn't seem to use it
            };
        }
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

        const { rule_id, points, computable } = scorePrediction(pred, result, rules);
        if (!computable) return;

        rankEntry.played_matches += 1;
        rankEntry.points += points;

        if (rule_id === 'exact_draw' || rule_id === 'exact_non_draw') {
            rankEntry.exact_scores += 1;
        } else if (rule_id === 'draw_not_exact' || rule_id === 'winner_not_exact') {
            rankEntry.correct_signs += 1;
        } else if (rule_id === 'wrong') {
            rankEntry.failed += 1;
        }
    });

    const arr = Object.values(rankingMap).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.exact_scores !== a.exact_scores) return b.exact_scores - a.exact_scores;
        if (b.correct_signs !== a.correct_signs) return b.correct_signs - a.correct_signs;
        const aName = a.display_name || '';
        const bName = b.display_name || '';
        return aName.localeCompare(bName);
    });

    arr.forEach((r, i) => r.position = i + 1);
    return arr;
}
