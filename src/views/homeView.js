import { state } from '../state.js';
import { getActiveMonthTitle, formatDate } from '../utils/dates.js';

export const homeView = {
    render() {
        let statsHtml = `
            <div style="text-align: center; padding: 2rem;">
                <p style="color: var(--text-secondary);">Los datos reales de participación y ranking se están cargando en segundo plano...</p>
            </div>
        `;

        if (state.coreLoaded) {
            const submittedCount = Object.values(state.predictionsSummary).filter(p => p.status === 'submitted').length;
            const totalCount = state.participants.filter(p => p.active).length;
            
            statsHtml = `
                <div class="stat-grid" style="margin-bottom: 0;">
                    <div class="stat-box" style="box-shadow: none;">
                        <div class="stat-value">${state.matches.length}</div>
                        <div class="stat-label">Partidos</div>
                    </div>
                    <div class="stat-box" style="box-shadow: none;">
                        <div class="stat-value" style="color: var(--accent-secondary);">${submittedCount} / ${totalCount}</div>
                        <div class="stat-label">Apuestas Recibidas</div>
                    </div>
                    <div class="stat-box" style="box-shadow: none;">
                        <div class="stat-value" style="color: var(--accent-info);">${totalCount}</div>
                        <div class="stat-label">Participantes Activos</div>
                    </div>
                </div>
            `;
        }

        let monthTitle = 'PORRA MENSUAL';
        if (state.coreLoaded && state.activeMonth) {
            monthTitle = getActiveMonthTitle(state.activeMonth).toUpperCase();
        }

        let limitHtml = '<p class="text-muted">Fecha límite: <strong>31 julio 23:59</strong></p>';
        if (state.coreLoaded && state.activeMonth && state.activeMonth.lock_at) {
            limitHtml = `<p class="text-muted">Fecha límite: <strong>${formatDate(state.activeMonth.lock_at)}</strong></p>`;
        }

        return `
            <div class="card" style="text-align: center; padding: 3rem 1.5rem 1.5rem 1.5rem;">
                <h2 style="font-size: 2.5rem; color: var(--accent-primary); margin-bottom: 0.5rem;">${monthTitle}</h2>
                <div style="margin: 1.5rem 0;">
                    <span class="badge badge-success">Abierta</span>
                </div>
                ${limitHtml}
                
                <hr style="margin: 2rem 0; border: 0; border-top: 1px solid var(--border-color);">
                ${statsHtml}
            </div>

            <div class="matches-preview-section">
                <h3 class="preview-title">Calendario de Partidos</h3>
                
                <div class="week-card">
                    <h4 class="week-title">Semana 1 (1 al 12 de agosto): Supercopas y Clásicos de Verano</h4>
                    <p class="week-desc">Como aún no hay liga regular en España e Inglaterra, abrimos con títulos en juego y los derbis más calientes de las ligas que no paran en verano.</p>
                    <ul class="match-list">
                        <li><strong>Paris Saint-Germain vs. Aston Villa</strong> (Supercopa de la UEFA, 12 de agosto). Un duelo interesantísimo entre el gigante francés y los ingleses, que vienen de arrasar en la Europa League y colarse cuartos en la Premier.</li>
                        <li><strong>Arsenal vs. Manchester United</strong> (Community Shield). El primer gran clásico inglés del año en Wembley con un título en juego.</li>
                        <li><strong>Sporting CP vs. FC Porto</strong> (Supercopa de Portugal). Uno de los derbis más tensos de Europa para arrancar la temporada lusa.</li>
                        <li><strong>PSV Eindhoven vs. Feyenoord</strong> (Supercopa de Países Bajos). Duelo a vida o muerte entre los dos grandes del fútbol holandés.</li>
                        <li><strong>Los Angeles Galaxy vs. LAFC</strong> (MLS). El famoso "Tráfico", el derbi de Los Ángeles, perfecto para rascar empates locos de madrugada.</li>
                        <li><strong>Flamengo vs. Palmeiras</strong> (Brasileirão). Choque de trenes entre las dos plantillas más potentes de Sudamérica, siempre igualado.</li>
                    </ul>
                </div>

                <div class="week-card">
                    <h4 class="week-title">Semana 2 (14 al 16 de agosto): Emboscadas en LaLiga</h4>
                    <p class="week-desc">Arranca el fútbol español. En lugar de poner estrenos cómodos, buscamos los estadios donde los equipos grandes suelen dejarse puntos.</p>
                    <ul class="match-list">
                        <li><strong>Valencia CF vs. FC Barcelona</strong> (LaLiga). Mestalla es históricamente una pesadilla para el Barça en la primera jornada; un partido donde apostar por el visitante no es nada seguro.</li>
                        <li><strong>RCD Mallorca vs. Real Madrid</strong> (LaLiga). Son Moix de noche a mediados de agosto es un campo trampa de manual, muy rocoso.</li>
                        <li><strong>Villarreal CF vs. Sevilla FC</strong> (LaLiga). Un duelo puro de clase media-alta por entrar en Europa. Fuerzas igualadísimas.</li>
                        <li><strong>Real Betis vs. Athletic Club</strong> (LaLiga). Choque de estilos en el Villamarín entre dos aspirantes a todo en la zona europea. Huele a empate con goles.</li>
                        <li><strong>SL Benfica vs. SC Braga</strong> (Primeira Liga). Uno de los cruces más duros de la liga portuguesa.</li>
                        <li><strong>Ajax vs. AZ Alkmaar</strong> (Eredivisie). Duelo de alta tensión en la liga holandesa.</li>
                    </ul>
                </div>

                <div class="week-card">
                    <h4 class="week-title">Semana 3 (21 al 24 de agosto): El Choque de Trenes</h4>
                    <p class="week-desc">Arranca la Premier League. Cruzamos la segunda jornada española con los mejores duelos de la primera inglesa, manteniendo a tus cuatro equipos fijos en situaciones comprometidas.</p>
                    <ul class="match-list">
                        <li><strong>Chelsea vs. Manchester City</strong> (Premier League). Un debut durísimo para el City en Stamford Bridge, impredecible desde el minuto uno.</li>
                        <li><strong>Real Sociedad vs. Real Madrid</strong> (LaLiga). El Reale Arena es probablemente la salida más difícil del año junto con el Metropolitano o San Mamés.</li>
                        <li><strong>Athletic Club vs. FC Barcelona</strong> (LaLiga). Un clásico espectacular donde la localía del Athletic equilibra completamente la balanza.</li>
                        <li><strong>Sevilla FC vs. Real Betis</strong> (LaLiga). El Gran Derbi. Cero estadísticas, pura tensión. El partido perfecto para buscar los 20 puntos del empate exacto.</li>
                        <li><strong>Arsenal vs. Aston Villa</strong> (Premier League). El campeón de liga contra el equipo revelación del año pasado.</li>
                        <li><strong>West Ham United vs. Tottenham Hotspur</strong> (Premier League). Derbi de Londres muy físico y tradicionalmente bronco.</li>
                    </ul>
                </div>

                <div class="week-card">
                    <h4 class="week-title">Semana 4 (28 al 31 de agosto): El Menú Completo Europeo</h4>
                    <p class="week-desc">Cerramos el mes con las ligas a pleno rendimiento y la incorporación de Italia y Alemania al calendario con partidazos.</p>
                    <ul class="match-list">
                        <li><strong>Manchester United vs. Liverpool</strong> (Premier League). El Clásico del Noroeste de Inglaterra. La máxima rivalidad histórica del país.</li>
                        <li><strong>Atlético de Madrid vs. Sevilla FC</strong> (LaLiga). Duelo físico y táctico en el Metropolitano, siempre de marcadores ajustados.</li>
                        <li><strong>Rayo Vallecano vs. Real Betis</strong> (LaLiga). Vallecas es un estadio de dimensiones engañosas donde la calidad individual se anula, propiciando muchos empates.</li>
                        <li><strong>Newcastle United vs. Tottenham Hotspur</strong> (Premier League). Dos equipos diseñados para atacar; un partido ideal para predecir marcadores abultados.</li>
                        <li><strong>Juventus vs. AC Milan</strong> (Serie A). Clásico absoluto en Italia para celebrar la vuelta del Calcio.</li>
                        <li><strong>Bayer Leverkusen vs. Bayern Múnich</strong> (Bundesliga). El partido de la jornada en Alemania entre el campeón invicto reciente y el gigante herido.</li>
                    </ul>
                </div>
            </div>
        `;
    },

    mount(container) {
        // Any DOM events for home view go here
    }
};
