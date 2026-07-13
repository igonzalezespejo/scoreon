export const adminView = {
    render() {
        return `
            <div class="card" style="text-align: center; padding: 4rem 2rem;">
                <span style="font-size: 4rem; display: block; margin-bottom: 1rem;">⚙️</span>
                <h2 style="color: var(--accent-secondary); margin-bottom: 1rem;">Panel de Administración</h2>
                <p class="text-muted" style="max-width: 600px; margin: 0 auto; font-size: 1.1rem; line-height: 1.6;">
                    El panel de administración web estará disponible en futuras versiones. <br><br>
                    Actualmente, toda la gestión de meses, partidos, y cálculo de resultados se realiza directamente en 
                    <strong style="color: var(--text-main);">Google Sheets</strong>, usando Google Apps Script.
                </p>
                
                <div style="margin-top: 3rem; padding: 2rem; background: var(--bg-dark); border-radius: var(--border-radius); border: 1px dashed var(--border-light); max-width: 500px; margin-left: auto; margin-right: auto;">
                    <h3 style="margin-bottom: 1rem; font-size: 1rem; color: var(--text-muted);">Acciones Futuras</h3>
                    <ul style="list-style: none; padding: 0; color: var(--text-muted); font-size: 0.9rem; text-align: left;">
                        <li style="margin-bottom: 0.5rem;">🔒 Bloqueo manual de mes</li>
                        <li style="margin-bottom: 0.5rem;">🔄 Forzar sincronización de datos</li>
                        <li style="margin-bottom: 0.5rem;">✏️ Corrección manual de resultados</li>
                        <li style="margin-bottom: 0.5rem;">👥 Gestión rápida de participantes</li>
                    </ul>
                </div>
            </div>
        `;
    }
};
