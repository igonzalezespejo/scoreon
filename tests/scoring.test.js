import { scorePrediction, scoreMatchPrediction, calculateMonthlyRanking } from '../src/scoring.js';

describe('scorePrediction', () => {
    const rules = {
        exact_draw: 20,
        exact_non_draw: 15,
        draw_not_exact: 10,
        winner_not_exact: 5,
        wrong: 0
    };
    
    it('should return exact_draw for exact match with draw', () => {
        const pred = { home_goals: 1, away_goals: 1 };
        const res = { home_goals: 1, away_goals: 1, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toEqual({ rule_id: 'exact_draw', points: 20, computable: true });
    });

    it('should return exact_non_draw for exact match without draw', () => {
        const pred = { home_goals: 2, away_goals: 1 };
        const res = { home_goals: 2, away_goals: 1, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toEqual({ rule_id: 'exact_non_draw', points: 15, computable: true });
    });

    it('should return draw_not_exact for correct draw but not exact', () => {
        const pred = { home_goals: 1, away_goals: 1 };
        const res = { home_goals: 0, away_goals: 0, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toEqual({ rule_id: 'draw_not_exact', points: 10, computable: true });
    });

    it('should return winner_not_exact for correct winner but not exact', () => {
        const pred = { home_goals: 2, away_goals: 1 };
        const res = { home_goals: 3, away_goals: 0, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toEqual({ rule_id: 'winner_not_exact', points: 5, computable: true });
    });

    it('should return winner_not_exact for correct away winner but not exact', () => {
        const pred = { home_goals: 1, away_goals: 2 };
        const res = { home_goals: 0, away_goals: 3, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toEqual({ rule_id: 'winner_not_exact', points: 5, computable: true });
    });

    it('should return wrong for wrong outcome', () => {
        const pred = { home_goals: 2, away_goals: 1 };
        const res = { home_goals: 1, away_goals: 2, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toEqual({ rule_id: 'wrong', points: 0, computable: true });
    });

    it('should return pending for pending result', () => {
        const pred = { home_goals: 2, away_goals: 1 };
        const res = { home_goals: 2, away_goals: 1, status: 'pending' };
        expect(scorePrediction(pred, res, rules)).toEqual({ rule_id: 'pending', points: 0, computable: false });
    });

    it('should return pending for incomplete prediction', () => {
        const pred = { home_goals: 2 };
        const res = { home_goals: 2, away_goals: 1, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toEqual({ rule_id: 'pending', points: 0, computable: false });
    });
});

describe('scoreMatchPrediction', () => {
    const rules = { exact_non_draw: 15 };

    it('should score correctly using full match object', () => {
        const pred = { home_goals: 2, away_goals: 1 };
        const match = { home_goals: 2, away_goals: 1, status: 'finished' };
        expect(scoreMatchPrediction(pred, match, rules)).toEqual({ rule_id: 'exact_non_draw', points: 15, computable: true });
    });
});

describe('calculateMonthlyRanking', () => {
    it('should calculate correct rankings when results are provided', () => {
        const participants = [
            { user_id: 'p1', display_name: 'User 1', active: true },
            { user_id: 'p2', display_name: 'User 2', active: true },
            { user_id: 'p3', display_name: 'User 3', active: true }
        ];
        const matches = [
            { match_id: 'm1' },
            { match_id: 'm2' }
        ];
        const predictions = [
            { participant_id: 'p1', match_id: 'm1', home_goals: 2, away_goals: 1 },
            { participant_id: 'p1', match_id: 'm2', home_goals: 1, away_goals: 1 },
            { participant_id: 'p2', match_id: 'm1', home_goals: 3, away_goals: 0 },
            { participant_id: 'p2', match_id: 'm2', home_goals: 0, away_goals: 1 }
        ];
        const results = [
            { match_id: 'm1', home_goals: 2, away_goals: 1, status: 'finished' },
            { match_id: 'm2', home_goals: 0, away_goals: 0, status: 'finished' }
        ];

        const ranking = calculateMonthlyRanking(participants, matches, predictions, results);
        
        expect(ranking.length).toBe(3);
        
        expect(ranking[0].user_id).toBe('p1');
        expect(ranking[0].points).toBe(25);
        expect(ranking[0].exact_scores).toBe(1);
        expect(ranking[0].correct_signs).toBe(1);
        expect(ranking[0].failed).toBe(0);

        expect(ranking[1].user_id).toBe('p2');
        expect(ranking[1].points).toBe(5);
        expect(ranking[1].exact_scores).toBe(0);
        expect(ranking[1].correct_signs).toBe(1);
        expect(ranking[1].failed).toBe(1);
        
        expect(ranking[2].user_id).toBe('p3');
        expect(ranking[2].points).toBe(0);
        expect(ranking[2].exact_scores).toBe(0);
        expect(ranking[2].correct_signs).toBe(0);
        expect(ranking[2].failed).toBe(0);
    });
});
