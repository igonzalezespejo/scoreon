/**
 * Minimal local season skeleton used by homeView to paint month cards
 * instantly, before bootstrapLight resolves. Real data (status, lock_at,
 * counts) always overrides this once it arrives from the backend.
 * Keep in sync manually with the Months sheet when adding a new month.
 */
export const staticSeason = [
    { month_id: '2026-08', title: 'Agosto 2026', display_order: 1 },
    { month_id: '2026-09', title: 'Septiembre 2026', display_order: 2 },
    { month_id: '2026-10', title: 'Octubre 2026', display_order: 3 }
];
