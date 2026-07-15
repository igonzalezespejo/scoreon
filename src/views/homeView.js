import { state } from '../state.js';
import { getActiveMonthTitle, formatDate } from '../utils/dates.js';
import { navigateTo } from '../app.js';
import { staticDescriptions } from '../data/staticDescriptions.js';

export const homeView = {
    render() {
        if (!state.coreLoaded) {
            return `
                <div style="text-align: center; padding: 2rem;">
                    <p style="color: var(--text-secondary);">Cargando la temporada...</p>
                </div>
            `;
        }

        let monthsHtml = '';
        if (state.months && state.months.length > 0) {
            monthsHtml = '<div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">';
            
            const totalCount = state.participants.filter(p => p.active).length;

            state.months.forEach(m => {
                const title = m.title || m.month_id;
                
                let statusBadge = '';
                let apostarText = 'Apostar';
                if (m.status === 'open') {
                    statusBadge = '<span class="badge badge-success">Abierta</span>';
                } else if (m.status === 'locked') {
                    statusBadge = '<span class="badge badge-warning">Cerrada</span>';
                    apostarText = 'Ver apuesta';
                } else if (m.status === 'scored') {
                    statusBadge = '<span class="badge badge-primary">Puntuada</span>';
                    apostarText = 'Ver apuesta';
                } else {
                    statusBadge = '<span class="badge badge-secondary">Archivada</span>';
                    apostarText = 'Ver apuesta';
                }

                const limitHtml = m.lock_at ? `<p class="text-muted" style="margin-top:0.5rem; font-size:0.9rem;">Límite: ${formatDate(m.lock_at)}</p>` : '';
                
                // Get month specific data if available
                let matchesCount = m.matches_count !== undefined ? m.matches_count : '-';
                let submittedCount = m.submitted_count !== undefined ? m.submitted_count : '-';
                
                const monthData = state.monthDataById[m.month_id];
                if (monthData) {
                    matchesCount = monthData.matches ? monthData.matches.length : 0;
                    if (monthData.predictionsSummary) {
                        submittedCount = Object.values(monthData.predictionsSummary).filter(p => p.status === 'submitted').length;
                    }
                } else if (m.month_id === state.activeMonth?.month_id && matchesCount === '-') {
                    matchesCount = state.matches ? state.matches.length : 0;
                    if (state.predictionsSummary) {
                        submittedCount = Object.values(state.predictionsSummary).filter(p => p.status === 'submitted').length;
                    }
                }

                let statsSection = `
                    <div style="margin-top: 1rem; margin-bottom: 1rem; display: flex; justify-content: space-around; font-size: 0.9rem; color: var(--text-secondary); min-height: 20px;">
                        <div><strong>${matchesCount}</strong> partidos</div>
                        <div><strong>${submittedCount}/${totalCount}</strong> apuestas</div>
                        <div><strong>${totalCount}</strong> participantes</div>
                    </div>
                `;

                monthsHtml += `
                    <div class="card month-card" style="padding: 1.5rem; position: relative; display: flex; flex-direction: column; height: 100%;">
                        <div style="text-align: center;">
                            <h3 style="color: var(--accent-primary); margin-bottom: 0.5rem;">${title}</h3>
                            ${statusBadge}
                            ${limitHtml}
                        </div>
                        ${statsSection}
                        
                        <div style="margin-top: auto; display: flex; gap: 10px; justify-content: center;">
                            <button class="btn btn-secondary btn-info-month" data-month-id="${m.month_id}">INFO</button>
                            <button class="btn btn-primary btn-apostar-month" data-month-id="${m.month_id}">${apostarText}</button>
                        </div>
                        
                        <div id="matches-info-${m.month_id}" style="display: none; margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                            <!-- Matches will be loaded here -->
                        </div>
                    </div>
                `;
            });
            monthsHtml += '</div>';
        } else {
            monthsHtml = '<p class="text-muted" style="text-align: center;">No hay meses configurados.</p>';
        }

        return `
            <div class="months-section">
                <h3 class="preview-title" style="margin-bottom: 1.5rem; color: var(--text-primary); border-bottom: 2px solid var(--accent-primary); display: inline-block; padding-bottom: 0.2rem;">Temporada Global</h3>
                ${monthsHtml}
            </div>
        `;
    },

    mount(container) {
        // APOSTAR button logic
        const apostarBtns = container.querySelectorAll('.btn-apostar-month');
        apostarBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const monthId = btn.getAttribute('data-month-id');
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
        });

        // INFO button logic
        const infoBtns = container.querySelectorAll('.btn-info-month');
        infoBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const monthId = btn.getAttribute('data-month-id');
                const infoContainer = container.querySelector(`#matches-info-${monthId}`);
                
                if (infoContainer.style.display === 'block') {
                    infoContainer.style.display = 'none';
                    return;
                }

                infoContainer.style.display = 'block';
                
                // Show static description if we have it
                const staticHtml = staticDescriptions[monthId] || '';
                
                infoContainer.innerHTML = staticHtml + '<div style="text-align: center; color: var(--text-secondary); margin-top: 1rem;">Cargando partidos...</div>';

                // Get matches from cache or fetch
                let matches = [];
                if (state.monthDataById[monthId] && state.monthDataById[monthId].matches) {
                    matches = state.monthDataById[monthId].matches;
                } else if (monthId === state.activeMonth?.month_id) {
                    matches = state.matches;
                } else {
                    try {
                        const api = await import('../api.js');
                        const data = await api.loadMonthData(monthId);
                        if (data && data.matches) {
                            matches = data.matches;
                        }
                    } catch (err) {
                        infoContainer.innerHTML = '<div style="text-align: center; color: var(--accent-danger);">Error al cargar los partidos.</div>';
                        return;
                    }
                }

                // Render dynamic matches below the static content
                const dynamicHtml = this.getMatchesListHtml(matches);
                infoContainer.innerHTML = staticHtml + dynamicHtml;
                
                // Re-render the view to update stats if they were just fetched
                if (!state.monthDataById[monthId]) {
                   // This is handled by loadMonthData automatically storing in state
                   // But if we want the stats at the top of the card to update, we could re-render
                   // However, for now let's just keep it simple and just show the matches.
                }
            });
        });
    },

    getMatchesListHtml(matches) {
        if (!matches || matches.length === 0) {
            return '<p class="text-muted" style="text-align: center; margin-top: 1rem;">No hay partidos configurados para este mes.</p>';
        }

        // Try to group by week based on kickoff_at, or just display a simple list
        // Since we don't have a "week" field in the schema, we'll just list them sorted by date.
        
        let html = '<div style="margin-top: 1.5rem;"><h4 style="color: var(--accent-primary); margin-bottom: 1rem; text-align: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Calendario Oficial</h4><ul style="list-style: none; padding: 0; margin: 0; text-align: left;">';
        matches.forEach(match => {
            const kickoff = formatDate(match.kickoff_at);
            const status = match.status === 'final' ? '<span class="badge badge-primary" style="font-size:0.7rem; padding: 2px 4px; margin-left: 5px;">Final</span>' : 
                           match.status === 'cancelled' ? '<span class="badge badge-danger" style="font-size:0.7rem; padding: 2px 4px; margin-left: 5px;">Cancelado</span>' : '';
            html += `
                <li style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--border-color);">
                    <div style="font-size: 0.85rem; color: var(--accent-secondary); font-weight: 600; text-transform: uppercase;">${match.competition}</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.3rem;">${kickoff} ${status}</div>
                    <div style="font-size: 1.1rem; font-weight: 500;">${match.home_team} <span style="color: var(--text-muted); margin: 0 0.5rem;">vs</span> ${match.away_team}</div>
                </li>
            `;
        });
        html += '</ul></div>';

        return html;
    }
};
