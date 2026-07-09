import { scorePrediction, scoreMatchPrediction, calculateMonthlyRanking } from '../src/scoring.js';

describe('scorePrediction', () => {
    const rules = { exact_score: 20, correct_sign: 5, wrong: 0 };
    
    it('should return exact_score for exact match', () => {
        const pred = { home_goals: 2, away_goals: 1 };
        const res = { home_goals: 2, away_goals: 1, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toBe(20);
    });

    it('should return correct_sign for correct sign (win)', () => {
        const pred = { home_goals: 2, away_goals: 1 };
        const res = { home_goals: 1, away_goals: 0, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toBe(5);
    });

    it('should return correct_sign for correct sign (draw)', () => {
        const pred = { home_goals: 1, away_goals: 1 };
        const res = { home_goals: 0, away_goals: 0, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toBe(5);
    });

    it('should return wrong for wrong outcome', () => {
        const pred = { home_goals: 2, away_goals: 1 };
        const res = { home_goals: 1, away_goals: 2, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toBe(0);
    });

    it('should return null for pending result', () => {
        const pred = { home_goals: 2, away_goals: 1 };
        const res = { home_goals: 2, away_goals: 1, status: 'pending' };
        expect(scorePrediction(pred, res, rules)).toBeNull();
    });

    it('should return null for incomplete prediction', () => {
        const pred = { home_goals: 2 };
        const res = { home_goals: 2, away_goals: 1, status: 'finished' };
        expect(scorePrediction(pred, res, rules)).toBeNull();
    });
});

describe('scoreMatchPrediction', () => {
    const rules = { exact_score: 20, correct_sign: 5, wrong: 0 };

    it('should score correctly using full match object', () => {
        const pred = { home_goals: 2, away_goals: 1 };
        const match = { home_goals: 2, away_goals: 1, status: 'finished' };
        expect(scoreMatchPrediction(pred, match, rules)).toBe(20);
    });
});

describe('calculateMonthlyRanking', () => {
    it('should calculate correct rankings when results are provided', () => {
        const participants = [
            { user_id: 'p1', name: 'User 1' },
            { user_id: 'p2', name: 'User 2' }
        ];
        const matches = [
            { match_id: 'm1' },
            { match_id: 'm2' }
        ];
        const predictions = [
            { participant_id: 'p1', match_id: 'm1', home_goals: 2, away_goals: 1 },
            { participant_id: 'p1', match_id: 'm2', home_goals: 1, away_goals: 1 },
            { participant_id: 'p2', match_id: 'm1', home_goals: 1, away_goals: 0 },
            { participant_id: 'p2', match_id: 'm2', home_goals: 0, away_goals: 1 }
        ];
        const results = [
            { match_id: 'm1', home_goals: 2, away_goals: 1, status: 'finished' },
            { match_id: 'm2', home_goals: 0, away_goals: 0, status: 'finished' }
        ];

        const ranking = calculateMonthlyRanking(participants, matches, predictions, results);
        
        // p1: m1 (20 pts), m2 (5 pts) -> 25 pts
        // p2: m1 (5 pts), m2 (0 pts) -> 5 pts
        
        expect(ranking.length).toBe(2);
        expect(ranking[0].participant.user_id).toBe('p1');
        expect(ranking[0].points).toBe(25);
        expect(ranking[0].exact_scores).toBe(1);
        expect(ranking[0].correct_signs).toBe(1);
        expect(ranking[0].failed).toBe(0);

        expect(ranking[1].participant.user_id).toBe('p2');
        expect(ranking[1].points).toBe(5);
        expect(ranking[1].exact_scores).toBe(0);
        expect(ranking[1].correct_signs).toBe(1);
        expect(ranking[1].failed).toBe(1);
    });

    it('should calculate correct rankings when results are embedded in matches', () => {
        const participants = [
            { user_id: 'p1', name: 'User 1' },
            { user_id: 'p2', name: 'User 2' }
        ];
        const matches = [
            { match_id: 'm1', home_goals: 2, away_goals: 1, status: 'finished' },
            { match_id: 'm2', home_goals: 0, away_goals: 0, status: 'finished' }
        ];
        const predictions = [
            { participant_id: 'p1', match_id: 'm1', home_goals: 2, away_goals: 1 },
            { participant_id: 'p1', match_id: 'm2', home_goals: 1, away_goals: 1 },
            { participant_id: 'p2', match_id: 'm1', home_goals: 1, away_goals: 0 },
            { participant_id: 'p2', match_id: 'm2', home_goals: 0, away_goals: 1 }
        ];

        const ranking = calculateMonthlyRanking(participants, matches, predictions);
        
        expect(ranking.length).toBe(2);
        expect(ranking[0].points).toBe(25);
        expect(ranking[1].points).toBe(5);
    });
});
