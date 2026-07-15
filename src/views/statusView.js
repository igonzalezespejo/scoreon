import { state } from '../state.js';
import { formatDate, getActiveMonthTitle } from '../utils/dates.js';

function fetchMonthData(monthId) {
    // Always hits the backend, even if this month is already cached: Sheets
    // can change from another tab/participant at any moment (someone submits
    // a bet, an admin edits a result), so a cache hit must not skip
    // revalidation — it only lets render() paint something instantly while
    // this call is in flight.
    state.monthDataLoadingId = monthId;
    state.monthDataError = null;

    return import('../api.js')
        .then(api => api.loadMonthData(monthId))
        .then(() => {
            if (state.monthDataLoadingId === monthId) state.monthDataLoadingId = null;
        })
        .catch(err => {
            if (state.monthDataLoadingId === monthId) state.monthDataLoadingId = null;
            state.monthDataError = { monthId, message: 'Error al cargar los datos de este mes.' };
            throw err;
        });
}

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

        const selectedMonthObj = state.getSelectedMonthObj();
        if (!selectedMonthObj) {
            return `<div class="card"><p>Mes no encontrado.</p></div>`;
        }

        const monthOptionsHtml = (state.months || []).map(m => {
            const title = m.title || m.month_id;
            return `<option value="${m.month_id}" ${m.month_id === state.selectedMonthId ? 'selected' : ''}>${title}</option>`;
        }).join('');

        const monthData = state.getSelectedMonthData();
        let bodyHtml;

        if (!monthData) {
            if (state.monthDataError && state.monthDataError.monthId === state.selectedMonthId) {
                bodyHtml = `
                    <div style="text-align: center; padding: 2rem;">
                        <p style="color: var(--accent-danger);">${state.monthDataError.message}</p>
                        <button type="button" class="btn btn-secondary" id="btn-retry-month" style="margin-top: 1rem;">Reintentar</button>
                    </div>
                `;
            } else {
                bodyHtml = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        Cargando resumen de participación de este mes...
                    </div>
                `;
            }
        } else {
            const activeParticipants = state.participants.filter(p => p.active);
            const predictionsSummary = monthData.predictionsSummary || {};

            let submittedCount = 0;
            let partialCount = 0;
            let missingCount = 0;

            const rows = activeParticipants.map(p => {
                const statusInfo = predictionsSummary[p.user_id] || { status: 'pending' };
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

            bodyHtml = `
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
            `;
        }

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

                ${bodyHtml}
            </div>
        `;
    },

    mount(container) {
        this.bindEvents(container);

        // Every time the view is entered (nav bar, month switch, or the
        // initial navigation to Home->Estado) we revalidate against the
        // backend — see fetchMonthData() above for why a cache hit isn't
        // enough on its own.
        this.loadAndRefresh(state.selectedMonthId);
    },

    bindEvents(container) {
        const monthSelect = container.querySelector('#status-month-select');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                state.selectedMonthId = e.target.value;
                // Re-render immediately (scoped loading state if this month
                // was never cached; cached data otherwise) and let mount()
                // (triggered by navigateTo) kick off the revalidation fetch.
                import('../app.js').then(app => app.navigateTo('status'));
            });
        }

        const retryBtn = container.querySelector('#btn-retry-month');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.loadAndRefresh(state.selectedMonthId);
            });
        }
    },

    loadAndRefresh(monthId) {
        fetchMonthData(monthId)
            .then(() => {
                if (state.selectedMonthId !== monthId) return;
                state.setSelectedMonth(monthId);
                // Repaint in place instead of going through app.navigateTo():
                // navigateTo() re-runs mount(), which would call
                // loadAndRefresh() again and fetch forever in a loop.
                this.repaint();
            })
            .catch(() => {
                if (state.selectedMonthId !== monthId) return;
                // Only force a repaint if we still have nothing cached (to
                // show the error/retry state). If a previous snapshot is
                // already on screen, leave it visible rather than replacing
                // real data with an error banner over a background hiccup.
                if (!state.monthDataById[monthId]) {
                    this.repaint();
                }
            });
    },

    repaint() {
        const view = document.getElementById('view-status');
        if (!view) return;
        view.innerHTML = this.render();
        this.bindEvents(view);
    }
};
