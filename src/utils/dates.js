/**
 * Date utility functions
 */

export function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('es-ES', options);
}

export function isPastLock(lockAtIsoString, serverTimeIsoString) {
    const lockTime = new Date(lockAtIsoString).getTime();
    const now = serverTimeIsoString ? new Date(serverTimeIsoString).getTime() : Date.now();
    return now >= lockTime;
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
        const isIsoDate = /^\\d{4}-\\d{2}-\\d{2}T/.test(String(activeMonth.title));
        if (!isIsoDate) {
            return activeMonth.title;
        }
    }
    
    if (activeMonth.month_id) {
        return buildMonthTitle(activeMonth.month_id);
    }
    
    return 'Mes activo';
}
