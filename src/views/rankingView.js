import { state } from '../state.js';

export const rankingView = {
    render() {
        let monthlyRows = state.rankingMonthly.map((r, i) => `
            <tr>
                <td><div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: ${i === 0 ? 'var(--accent-secondary)' : i===1 ? '#94a3b8' : i===2 ? '#cd7f32' : '#f1f5f9'}; color: ${i < 3 ? '#000' : 'inherit'}; font-weight: bold;">${r.position}</div></td>
                <td style="font-weight: 600;">${r.display_name}</td>
                <td style="color: var(--accent-primary); font-weight: 800; font-size: 1.1rem;">${r.points}</td>
                <td><span style="color: var(--success-color); margin-right: 5px;">${r.exact_scores} exactos</span> / <span style="color: var(--accent-secondary);">${r.correct_signs} signos</span></td>
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

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                <div class="card">
                    <h2 class="card-title">Ranking Mensual (${state.activeMonth ? state.activeMonth.title : ''})</h2>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 50px;">Pos</th>
                                    <th>Participante</th>
                                    <th>Puntos</th>
                                    <th>Aciertos</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthlyRows || '<tr><td colspan="4" style="text-align: center;">No hay datos</td></tr>'}
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
    }
};
