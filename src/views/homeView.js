import { state } from '../state.js';
import { formatDate, getDaysRemaining } from '../utils/dates.js';

export const homeView = {
    render() {
        const activeMonth = state.activeMonth;
        if (!activeMonth) {
            return `<div class="card"><p>No hay mes activo configurado.</p></div>`;
        }

        const daysRemaining = getDaysRemaining(activeMonth.lock_at, state.serverTime);
        const isOpen = activeMonth.status === 'open';
        
        let statusHtml = '';
        if (isOpen && daysRemaining > 0) {
            statusHtml = `<span class="badge badge-success">Abierta</span><p class="text-muted" style="margin-top: 5px;">Cierra en ${daysRemaining} días</p>`;
        } else if (isOpen) {
            statusHtml = `<span class="badge badge-warning">Cierra hoy</span>`;
        } else {
            statusHtml = `<span class="badge badge-danger">Cerrada</span>`;
        }

        const submittedCount = Object.values(state.predictionsSummary).filter(p => p.status === 'submitted').length;
        const totalCount = state.participants.filter(p => p.active).length;

        return `
            <div class="card" style="text-align: center; padding: 3rem 1.5rem;">
                <h2 style="font-size: 2.5rem; color: var(--accent-primary); margin-bottom: 0.5rem;">${activeMonth.title}</h2>
                <div style="margin: 1.5rem 0;">
                    ${statusHtml}
                </div>
                <p class="text-muted">Fecha límite: <strong>${formatDate(activeMonth.lock_at)}</strong></p>
            </div>

            <div class="stat-grid">
                <div class="stat-box">
                    <div class="stat-value">${state.matches.length}</div>
                    <div class="stat-label">Partidos</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value" style="color: var(--accent-secondary);">${submittedCount} / ${totalCount}</div>
                    <div class="stat-label">Apuestas Recibidas</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value" style="color: var(--accent-info);">${state.rankingGlobal.length}</div>
                    <div class="stat-label">Participantes Ranking</div>
                </div>
            </div>
        `;
    },

    mount(container) {
        // Any DOM events for home view go here
    }
};
