import { state } from '../state.js';
import { formatDate } from '../utils/dates.js';

export const statusView = {
    render() {
        const activeParticipants = state.participants.filter(p => p.active);
        
        let submittedCount = 0;
        let missingCount = 0;

        const rows = activeParticipants.map(p => {
            const statusInfo = state.predictionsSummary[p.user_id];
            const hasSubmitted = statusInfo && statusInfo.status === 'submitted';
            
            if (hasSubmitted) submittedCount++;
            else missingCount++;

            const statusBadge = hasSubmitted 
                ? `<span class="badge badge-success">Recibida</span>` 
                : `<span class="badge badge-warning">Pendiente</span>`;
                
            const dateStr = hasSubmitted && statusInfo.submitted_at 
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

        return `
            <div class="card">
                <h2 class="card-title">Estado de Apuestas</h2>
                <p class="text-muted" style="margin-bottom: 1.5rem;">
                    Resumen de participación para <strong>${state.activeMonth ? state.activeMonth.title : ''}</strong>
                </p>

                <div class="stat-grid" style="margin-bottom: 2rem;">
                    <div class="stat-box">
                        <div class="stat-value" style="color: var(--accent-primary);">${submittedCount}</div>
                        <div class="stat-label">Han Apostado</div>
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
    }
};
