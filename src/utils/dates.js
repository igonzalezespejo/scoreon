/**
 * Date utility functions
 */

export function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' };
    return date.toLocaleDateString('es-ES', options);
}

export function isPastLock(lockAtIsoString, serverTimeIsoString) {
    const lockTime = new Date(lockAtIsoString).getTime();
    const now = serverTimeIsoString ? new Date(serverTimeIsoString).getTime() : Date.now();
    return now >= lockTime;
}

// Un partido deja de admitir apuestas en su lock_at, y si esa columna está
// vacía en Sheets, en su kickoff_at (misma regla que aplica el backend en
// actionSavePrediction, ver Code.gs). Sin ninguna de las dos fechas el partido
// nunca se bloquea: es preferible dejar apostar de más a bloquear una tarjeta
// por un hueco en la hoja.
//
// Usa la hora del navegador, así que un reloj mal puesto puede adelantar o
// atrasar el bloqueo visual. No es un problema de integridad: el backend
// revalida cada partido contra su propia hora y es la autoridad final.
export function isMatchLocked(match) {
    if (!match) return false;
    const lockAt = match.lock_at || match.kickoff_at;
    if (!lockAt) return false;
    const lockTime = new Date(lockAt).getTime();
    if (isNaN(lockTime)) return false;
    return Date.now() >= lockTime;
}

export function getDaysRemaining(targetIsoString, serverTimeIsoString) {
    const target = new Date(targetIsoString).getTime();
    const now = serverTimeIsoString ? new Date(serverTimeIsoString).getTime() : Date.now();
    const diffMs = target - now;
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function buildMonthTitle(monthId) {
    if (!monthId) return 'Mes activo';
    const parts = String(monthId).split('-');
    if (parts.length !== 2) return monthId;
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    if (month >= 1 && month <= 12) {
        return `${months[month - 1]} ${year}`;
    }
    return monthId;
}

export function getActiveMonthTitle(activeMonth) {
    if (!activeMonth) return 'Mes activo';
    
    if (activeMonth.title) {
        const isIsoDate = /^\d{4}-\d{2}-\d{2}T/.test(String(activeMonth.title));
        if (!isIsoDate) {
            return activeMonth.title;
        }
    }
    
    if (activeMonth.month_id) {
        return buildMonthTitle(activeMonth.month_id);
    }
    
    return 'Mes activo';
}
