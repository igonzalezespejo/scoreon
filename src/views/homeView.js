import { state } from '../state.js';
import { getActiveMonthTitle, formatDate } from '../utils/dates.js';
import { navigateTo } from '../app.js';

export const homeView = {
    render() {
        if (!state.coreLoaded) {
            return `
                <div style="text-align: center; padding: 2rem;">
                    <p style="color: var(--text-secondary);">Cargando la temporada...</p>
                </div>
            `;
        }

        const submittedCount = Object.values(state.predictionsSummary).filter(p => p.status === 'submitted').length;
        const totalCount = state.participants.filter(p => p.active).length;
        
        let statsHtml = `
            <div class="stat-grid" style="margin-bottom: 0;">
                <div class="stat-box" style="box-shadow: none;">
                    <div class="stat-value">${state.matches.length}</div>
                    <div class="stat-label">Partidos en Juego</div>
                </div>
                <div class="stat-box" style="box-shadow: none;">
                    <div class="stat-value" style="color: var(--accent-secondary);">${submittedCount} / ${totalCount}</div>
                    <div class="stat-label">Apuestas Mensuales</div>
                </div>
                <div class="stat-box" style="box-shadow: none;">
                    <div class="stat-value" style="color: var(--accent-info);">${totalCount}</div>
                    <div class="stat-label">Participantes Activos</div>
                </div>
            </div>
        `;

        let monthsHtml = '';
        if (state.months && state.months.length > 0) {
            monthsHtml = '<div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">';
            state.months.forEach(m => {
                const title = m.title || m.month_id;
                const statusBadge = m.status === 'open' ? '<span class="badge badge-success">Abierta</span>' : '<span class="badge badge-danger">Cerrada</span>';
                const limitHtml = m.lock_at ? `<p class="text-muted" style="margin-top:0.5rem; font-size:0.9rem;">Límite: ${formatDate(m.lock_at)}</p>` : '';
                
                monthsHtml += `
                    <div class="card month-card" data-month-id="${m.month_id}" style="cursor:pointer; transition: transform 0.2s; text-align: center; padding: 1.5rem;">
                        <h3 style="color: var(--accent-primary); margin-bottom: 0.5rem;">${title}</h3>
                        ${statusBadge}
                        ${limitHtml}
                        <button class="btn btn-primary" style="margin-top:1rem; width: 100%;">Ver Mes</button>
                    </div>
                `;
            });
            monthsHtml += '</div>';
        } else {
            monthsHtml = '<p class="text-muted" style="text-align: center;">No hay meses configurados.</p>';
        }

        return `
            <div class="card" style="text-align: center; padding: 2rem 1.5rem;">
                <h2 style="font-size: 2.5rem; color: var(--accent-primary); margin-bottom: 0.5rem;">TEMPORADA GLOBAL</h2>
                <p class="text-muted">Selecciona un mes para participar o ver los resultados.</p>
                <hr style="margin: 2rem 0; border: 0; border-top: 1px solid var(--border-color);">
                ${statsHtml}
            </div>

            <div class="months-section" style="margin-top: 2rem;">
                <h3 class="preview-title" style="margin-bottom: 1rem; color: var(--text-primary); border-bottom: 2px solid var(--accent-primary); display: inline-block; padding-bottom: 0.2rem;">Meses de Competición</h3>
                ${monthsHtml}
            </div>
        `;
    },

    mount(container) {
        const monthCards = container.querySelectorAll('.month-card');
        monthCards.forEach(card => {
            card.addEventListener('click', () => {
                const monthId = card.getAttribute('data-month-id');
                if (monthId) {
                    state.selectedMonthId = monthId;
                    
                    // Update navigation buttons active state
                    const navButtons = document.querySelectorAll('.btn-nav');
                    navButtons.forEach(b => b.classList.remove('active'));
                    const betBtn = Array.from(navButtons).find(b => b.getAttribute('data-target') === 'betting');
                    if (betBtn) betBtn.classList.add('active');
                    
                    navigateTo('betting');
                }
            });
            
            // Hover effect
            card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-5px)');
            card.addEventListener('mouseleave', () => card.style.transform = 'translateY(0)');
        });
    }
};
