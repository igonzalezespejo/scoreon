export function validateGoals(home_goals, away_goals) {
    if (home_goals === undefined || home_goals === null || away_goals === undefined || away_goals === null) {
        return false;
    }
    
    // Convert to number for checks
    const h = Number(home_goals);
    const a = Number(away_goals);

    if (Number.isNaN(h) || Number.isNaN(a)) return false;
    if (!Number.isInteger(h) || !Number.isInteger(a)) return false;
    if (h < 0 || a < 0) return false;
    if (h > 20 || a > 20) return false;

    return true;
}

export function validatePredictionPayload(payload, context = {}) {
    const errors = [];
    if (!payload) {
        return { isValid: false, errors: ['Payload is missing'] };
    }
    
    if (!validateGoals(payload.home_goals, payload.away_goals)) {
        errors.push('Invalid goals format or values out of bounds');
    }

    if (!payload.match_id) {
        errors.push('Missing match_id');
    }

    if (!payload.participant_id) {
        errors.push('Missing participant_id');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}
