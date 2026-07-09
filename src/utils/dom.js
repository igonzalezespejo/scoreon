/**
 * DOM Utility functions for safer and easier DOM manipulation
 */

export function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

export function htmlToElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

export function htmlToElements(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.childNodes;
}

export function empty(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = createElement('div', `toast toast-${type}`, message);
    if (type === 'success') toast.style.borderLeftColor = 'var(--accent-primary)';
    if (type === 'error') toast.style.borderLeftColor = 'var(--accent-danger)';

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
