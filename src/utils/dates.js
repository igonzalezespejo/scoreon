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
