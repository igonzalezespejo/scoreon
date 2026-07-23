import { state } from '../state.js';
import { formatDate, buildMonthTitle } from '../utils/dates.js';
import { navigateTo } from '../app.js';
import { staticDescriptions } from '../data/staticDescriptions.js';
import { staticSeason } from '../data/staticSeason.js';

function getDisplayMonths() {
    const staticList = [...staticSeason].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    if (!state.coreLoaded) {
        return staticList.map(m => ({ ...m, source: 'static' }));
    }

    const realMap = {};
    (state.months || []).forEach(m => { realMap[m.month_id] = m; });

    const merged = [];
    const seen = new Set();

    staticList.forEach(sm => {
        const real = realMap[sm.month_id];
        if (real) {
            merged.push({ ...sm, ...real, source: 'real' });
        } else {
            merged.push({ ...sm, source: 'pending' });
        }
        seen.add(sm.month_id);
    });

    (state.months || []).forEach(m => {
        if (!seen.has(m.month_id)) {
            merged.push({ display_order: 999, ...m, source: 'real' });
        }
    });

    merged.sort((a, b) => {
        const orderA = a.display_order !== undefined ? a.display_order : 999;
        const orderB = b.display_order !== undefined ? b.display_order : 999;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.month_id).localeCompare(String(b.month_id));
    });

    return merged;
}

export const homeView = {
    render() {
        const months = getDisplayMonths();

        let monthsHtml = '';
        if (months.length > 0) {
            monthsHtml = '<div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">';

            const totalCount = state.coreLoaded ? state.participants.filter(p => p.active).length : null;

            months.forEach(m => {
                const title = m.title || buildMonthTitle(m.month_id);

                let statusBadge;
                let apostarText = 'Apostar';

                if (m.source === 'static') {
                    statusBadge = '<span class="badge badge-secondary">Cargando...</span>';
                } else if (m.source === 'pending') {
                    statusBadge = '<span class="badge badge-secondary">Configuración pendiente</span>';
                } else if (m.status === 'open') {
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

                let matchesCount = '···';
                let submittedCount = '···';
                let participantsCount = totalCount !== null ? totalCount : '···';

                if (m.source === 'real') {
                    matchesCount = m.matches_count !== undefined ? m.matches_count : '-';
                    submittedCount = m.submitted_count !== undefined ? m.submitted_count : '-';

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
                }

                const statsSection = `
                    <div style="margin-top: 1rem; margin-bottom: 1rem; display: flex; justify-content: space-around; font-size: 0.9rem; color: var(--text-secondary); min-height: 20px;">
                        <div><strong>${matchesCount}</strong> partidos</div>
                        <div><strong>${submittedCount}/${participantsCount}</strong> apuestas</div>
                        <div><strong>${participantsCount}</strong> participantes</div>
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

        const rulesHtml = `
            <div class="rules-section" style="margin-bottom: 3rem;">
                <h3 class="preview-title" style="margin-bottom: 1.5rem; color: var(--text-primary); border-bottom: 2px solid var(--accent-primary); display: inline-block; padding-bottom: 0.2rem;">¿Cómo se puntúa?</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.6;">¡Cada detalle cuenta! En nuestra porra puedes sumar hasta <strong>10 puntos por partido</strong>. Los puntos se acumulan por cada bloque que aciertes:</p>
                
                <div class="rules-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <div class="card" style="padding: 1.5rem; border-left: 5px solid var(--accent-primary); display: flex; flex-direction: column; justify-content: space-between;">
                        <div style="display: flex; align-items: flex-start; margin-bottom: 1rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; line-height: 1.3;">🎯 Ganador/Empate</h4>
                            <span style="margin-left: auto; color: #fff; background-color: var(--accent-primary); font-weight: 900; font-size: 1.4rem; padding: 0.4rem 1rem; border-radius: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); letter-spacing: 1px; line-height: 1;">+4</span>
                        </div>
                        <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">Si aciertas qué equipo gana (o si es empate). ¡Incluso si fallas los goles!</p>
                    </div>

                    <div class="card" style="padding: 1.5rem; border-left: 5px solid var(--accent-secondary); display: flex; flex-direction: column; justify-content: space-between;">
                        <div style="display: flex; align-items: flex-start; margin-bottom: 1rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; line-height: 1.3;">⚽ Goles Local</h4>
                            <span style="margin-left: auto; color: #fff; background-color: var(--accent-secondary); font-weight: 900; font-size: 1.4rem; padding: 0.4rem 1rem; border-radius: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); letter-spacing: 1px; line-height: 1;">+2</span>
                        </div>
                        <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">Si adivinas exactamente los goles que marca el equipo de casa.</p>
                    </div>

                    <div class="card" style="padding: 1.5rem; border-left: 5px solid var(--accent-secondary); display: flex; flex-direction: column; justify-content: space-between;">
                        <div style="display: flex; align-items: flex-start; margin-bottom: 1rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; line-height: 1.3;">⚽ Goles Visitante</h4>
                            <span style="margin-left: auto; color: #fff; background-color: var(--accent-secondary); font-weight: 900; font-size: 1.4rem; padding: 0.4rem 1rem; border-radius: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); letter-spacing: 1px; line-height: 1;">+2</span>
                        </div>
                        <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">Si adivinas exactamente los goles que marca el equipo de fuera.</p>
                    </div>

                    <div class="card" style="padding: 1.5rem; border-left: 5px solid #10b981; background: linear-gradient(145deg, rgba(16,185,129,0.05) 0%, transparent 100%); display: flex; flex-direction: column; justify-content: space-between;">
                        <div style="display: flex; align-items: flex-start; margin-bottom: 1rem;">
                            <h4 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; line-height: 1.3;">🔥 Pleno (Bonus)</h4>
                            <span style="margin-left: auto; color: #fff; background-color: #10b981; font-weight: 900; font-size: 1.4rem; padding: 0.4rem 1rem; border-radius: 30px; box-shadow: 0 4px 10px rgba(16,185,129,0.3); letter-spacing: 1px; line-height: 1;">+2</span>
                        </div>
                        <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">Si aciertas el resultado exacto, te llevas el bonus para lograr el pleno de 10 puntos.</p>
                    </div>
                </div>

                <div class="card" style="padding: 1.5rem; background-color: rgba(0,0,0,0.1);">
                    <h4 style="margin-bottom: 1rem; color: var(--text-primary);">💡 Ejemplos (Si el resultado real es 2-1)</h4>
                    <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.95rem; color: var(--text-secondary); display: grid; gap: 1rem;">
                        <li style="display: flex; gap: 0.8rem; align-items: flex-start;"><span style="color: #10b981; font-size: 1.1rem; line-height: 1.2;">✅</span> <div><strong>Predices 2-1:</strong> Aciertas ganador <strong style="color: var(--accent-primary);">+4</strong>, goles local <strong style="color: var(--accent-secondary);">+2</strong>, goles visitante <strong style="color: var(--accent-secondary);">+2</strong> y pleno <strong style="color: #10b981;">+2</strong> = <strong style="color: var(--text-primary); font-size: 1.1rem;">10 puntos</strong></div></li>
                        <li style="display: flex; gap: 0.8rem; align-items: flex-start;"><span style="color: #10b981; font-size: 1.1rem; line-height: 1.2;">✅</span> <div><strong>Predices 2-0:</strong> Aciertas ganador <strong style="color: var(--accent-primary);">+4</strong> y goles local <strong style="color: var(--accent-secondary);">+2</strong> = <strong style="color: var(--text-primary); font-size: 1.1rem;">6 puntos</strong></div></li>
                        <li style="display: flex; gap: 0.8rem; align-items: flex-start;"><span style="color: #10b981; font-size: 1.1rem; line-height: 1.2;">✅</span> <div><strong>Predices 3-0:</strong> Aciertas ganador <strong style="color: var(--accent-primary);">+4</strong> pero fallas todos los goles = <strong style="color: var(--text-primary); font-size: 1.1rem;">4 puntos</strong></div></li>
                        <li style="display: flex; gap: 0.8rem; align-items: flex-start;"><span style="color: #10b981; font-size: 1.1rem; line-height: 1.2;">✅</span> <div><strong>Predices 1-1:</strong> Fallas ganador y local, pero acertaste que visitante metía 1 gol <strong style="color: var(--accent-secondary);">+2</strong> = <strong style="color: var(--text-primary); font-size: 1.1rem;">2 puntos</strong></div></li>
                    </ul>
                </div>
            </div>
        `;

        return `
            <div class="home-layout">
                ${rulesHtml}
                <div class="months-section">
                    <h3 class="preview-title" style="margin-bottom: 1.5rem; color: var(--text-primary); border-bottom: 2px solid var(--accent-primary); display: inline-block; padding-bottom: 0.2rem;">Temporada Global</h3>
                    ${monthsHtml}
                </div>
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

                if (!state.coreLoaded) {
                    infoContainer.innerHTML = staticHtml + '<div style="text-align: center; color: var(--text-secondary); margin-top: 1rem;">Cargando datos del mes...</div>';
                    return;
                }

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
