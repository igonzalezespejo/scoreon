import { state } from '../state.js';
import { getActiveMonthTitle } from '../utils/dates.js';

export const rankingView = {
    render() {
        if (state.rankingsLoading) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title">Cargando ranking...</h2>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">Calculando posiciones, por favor espera...</p>
                </div>
            `;
        }

        if (state.rankingsError) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title" style="color: var(--accent-danger);">Error al cargar ranking</h2>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">${state.rankingsError}</p>
                    <button class="btn btn-primary" style="margin-top: 1.5rem;" onclick="window.location.reload()">Recargar aplicación</button>
                </div>
            `;
        }

        if (!state.rankingsLoaded) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title">Ranking pendiente de carga</h2>
                </div>
            `;
        }

        const selectedMonthObj = state.getSelectedMonthObj();
        
        let filteredMonthly = state.rankingMonthly;
        if (state.selectedMonthId) {
            filteredMonthly = state.rankingMonthly.filter(r => r.month_id === state.selectedMonthId);
        }

        let monthlyRows = filteredMonthly.map((r, i) => `
            <tr>
                <td><div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: ${i === 0 ? 'var(--accent-secondary)' : i===1 ? '#94a3b8' : i===2 ? '#cd7f32' : '#f1f5f9'}; color: ${i < 3 ? '#000' : 'inherit'}; font-weight: bold;">${r.position}</div></td>
                <td style="font-weight: 600;">${r.display_name}</td>
                <td style="color: var(--accent-primary); font-weight: 800; font-size: 1.1rem; text-align: center;">${r.points}</td>
                <td style="text-align: center;">${r.s1_points || 0}</td>
                <td style="text-align: center;">${r.s2_points || 0}</td>
                <td style="text-align: center;">${r.s3_points || 0}</td>
                <td style="text-align: center;">${r.s4_points || 0}</td>
            </tr>
        `).join('');

        let globalRows = state.rankingGlobal.map((r, i) => `
            <tr>
                <td><div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: ${i === 0 ? 'var(--accent-secondary)' : i===1 ? '#94a3b8' : i===2 ? '#cd7f32' : '#f1f5f9'}; color: ${i < 3 ? '#000' : 'inherit'}; font-weight: bold;">${r.position}</div></td>
                <td style="font-weight: 600;">${r.display_name}</td>
                <td style="color: var(--accent-secondary); font-weight: 800; font-size: 1.1rem;">${r.total_points}</td>
                <td>${r.months_played}</td>
            </tr>
        `).join('');

        const monthOptionsHtml = (state.months || []).map(m => {
            const title = m.title || m.month_id;
            return `<option value="${m.month_id}" ${m.month_id === state.selectedMonthId ? 'selected' : ''}>${title}</option>`;
        }).join('');

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                        <h2 class="card-title" style="margin-bottom: 0;">Ranking Mensual</h2>
                        <select id="ranking-month-select" class="form-select" style="width: auto;">
                            ${monthOptionsHtml}
                        </select>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 50px;">Pos</th>
                                    <th>Participante</th>
                                    <th style="text-align: center;">Total</th>
                                    <th style="text-align: center;">S1</th>
                                    <th style="text-align: center;">S2</th>
                                    <th style="text-align: center;">S3</th>
                                    <th style="text-align: center;">S4</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthlyRows || '<tr><td colspan="7" style="text-align: center;">No hay datos</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="card">
                    <h2 class="card-title">Ranking Global</h2>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 50px;">Pos</th>
                                    <th>Participante</th>
                                    <th>Total Puntos</th>
                                    <th>Meses Jugados</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${globalRows || '<tr><td colspan="4" style="text-align: center;">No hay datos</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    mount(container) {
        const monthSelect = container.querySelector('#ranking-month-select');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                // rankingMonthly already contains every month's rows (action=rankings
                // is not filtered by month), so switching months here is a pure
                // client-side filter — no network call needed.
                state.selectedMonthId = e.target.value;
                import('../app.js').then(app => app.navigateTo('ranking'));
            });
        }
    }
};
