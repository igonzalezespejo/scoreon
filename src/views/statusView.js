import { state } from '../state.js';
import { formatDate, getActiveMonthTitle } from '../utils/dates.js';

export const statusView = {
    render() {
        if (!state.coreLoaded) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title">Cargando estado de apuestas...</h2>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">Recopilando la participación del mes.</p>
                </div>
            `;
        }

        if (state.coreError) {
            return `
                <div class="card" style="text-align: center; padding: 3rem;">
                    <h2 class="card-title" style="color: var(--accent-danger);">Error al cargar estado</h2>
                    <p style="color: var(--text-secondary); margin-top: 1rem;">${state.coreError}</p>
                    <button class="btn btn-primary" style="margin-top: 1.5rem;" onclick="window.location.reload()">Recargar aplicación</button>
                </div>
            `;
        }

        const activeParticipants = state.participants.filter(p => p.active);
        
        let submittedCount = 0;
        let partialCount = 0;
        let missingCount = 0;

        const rows = activeParticipants.map(p => {
            const statusInfo = state.predictionsSummary[p.user_id] || { status: 'pending' };
            const status = statusInfo.status;
            
            if (status === 'submitted') submittedCount++;
            else if (status === 'partial') partialCount++;
            else missingCount++;

            let statusBadge = '';
            if (status === 'submitted') {
                statusBadge = `<span class="badge badge-success">Completa</span>`;
            } else if (status === 'partial') {
                statusBadge = `<span class="badge badge-warning">Parcial (${statusInfo.submitted_count || 0}/${statusInfo.total_matches || 0})</span>`;
            } else {
                statusBadge = `<span class="badge badge-secondary">Pendiente</span>`;
            }
                
            const dateStr = status !== 'pending' && statusInfo.submitted_at 
                ? formatDate(statusInfo.submitted_at) 
                : '-';

            return `
                <tr>
                    <td style="font-weight: 600;">${p.display_name}</td>
                    <td>${statusBadge}</td>
                    <td style="color: var(--text-muted); font-size: 0.9rem;">${dateStr}</td>
                </tr>
            `;
        }).join('');

        const selectedMonthObj = state.getSelectedMonthObj();
        if (!selectedMonthObj) {
            return `<div class="card"><p>Mes no encontrado.</p></div>`;
        }

        const monthOptionsHtml = (state.months || []).map(m => {
            const title = m.title || m.month_id;
            return `<option value="${m.month_id}" ${m.month_id === state.selectedMonthId ? 'selected' : ''}>${title}</option>`;
        }).join('');

        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 class="card-title" style="margin-bottom: 0;">Estado de Apuestas</h2>
                        <p class="text-muted" style="margin-top: 0.5rem; margin-bottom: 0;">
                            Resumen de participación para <strong>${selectedMonthObj.title || selectedMonthObj.month_id}</strong>
                        </p>
                    </div>
                    <select id="status-month-select" class="form-select" style="width: auto;">
                        ${monthOptionsHtml}
                    </select>
                </div>

                <div class="stat-grid" style="margin-bottom: 2rem;">
                    <div class="stat-box">
                        <div class="stat-value" style="color: var(--accent-primary);">${submittedCount}</div>
                        <div class="stat-label">Completas</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" style="color: #f39c12;">${partialCount}</div>
                        <div class="stat-label">Parciales</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" style="color: var(--accent-danger);">${missingCount}</div>
                        <div class="stat-label">Faltan</div>
                    </div>
                </div>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Participante</th>
                                <th>Estado</th>
                                <th>Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    mount(container) {
        const monthSelect = container.querySelector('#status-month-select');
        if (monthSelect) {
            monthSelect.addEventListener('change', async (e) => {
                const newMonthId = e.target.value;
                monthSelect.disabled = true;
                
                try {
                    import('../api.js').then(async (api) => {
                        await api.loadMonthData(newMonthId);
                        state.setSelectedMonth(newMonthId);
                        import('../app.js').then(app => app.navigateTo('status'));
                    });
                } catch (err) {
                    import('../utils/dom.js').then(dom => dom.showToast("Error al cargar datos del mes", "error"));
                    monthSelect.disabled = false;
                }
            });
        }
    }
};
