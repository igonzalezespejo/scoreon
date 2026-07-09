import { validateGoals, validatePredictionPayload } from '../src/utils/validation.js';

describe('validateGoals', () => {
    it('should return true for valid integers', () => {
        expect(validateGoals(2, 1)).toBe(true);
        expect(validateGoals(0, 0)).toBe(true);
        expect(validateGoals(20, 20)).toBe(true);
    });

    it('should return false for negative goals', () => {
        expect(validateGoals(-1, 2)).toBe(false);
        expect(validateGoals(2, -5)).toBe(false);
    });

    it('should return false for non-integers', () => {
        expect(validateGoals(1.5, 2)).toBe(false);
        expect(validateGoals(2, 0.5)).toBe(false);
    });

    it('should return false for goals > 20', () => {
        expect(validateGoals(21, 2)).toBe(false);
        expect(validateGoals(2, 30)).toBe(false);
    });

    it('should handle strings that represent valid numbers', () => {
        expect(validateGoals("2", "1")).toBe(true);
    });

    it('should return false for missing or invalid data', () => {
        expect(validateGoals(null, 1)).toBe(false);
        expect(validateGoals(undefined, 1)).toBe(false);
        expect(validateGoals("abc", 1)).toBe(false);
    });
});

describe('validatePredictionPayload', () => {
    it('should return valid for a correct payload', () => {
        const payload = { participant_id: 'p1', match_id: 'm1', home_goals: 2, away_goals: 1 };
        const result = validatePredictionPayload(payload);
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    it('should return invalid for missing participant or match', () => {
        const result = validatePredictionPayload({ home_goals: 2, away_goals: 1 });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing match_id');
        expect(result.errors).toContain('Missing participant_id');
    });

    it('should return invalid for incomplete prediction', () => {
        const payload = { participant_id: 'p1', match_id: 'm1', home_goals: 2 }; // missing away_goals
        const result = validatePredictionPayload(payload);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid goals format or values out of bounds');
    });
});
