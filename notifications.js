// ============================================================
// NOTIFICATIONS - Toast System
// ============================================================

let container = null;

// ============================================================
// INITIALIZATION
// ============================================================
export function initNotifications() {
    container = document.getElementById('notificationContainer');
    if (!container) {
        console.warn('⚠️ Notification container tidak ditemukan, membuat baru...');
        container = document.createElement('div');
        container.id = 'notificationContainer';
        document.body.appendChild(container);
    }
    return container;
}

// ============================================================
// SHOW NOTIFICATION
// ============================================================
export function showNotification(type = 'info', title = '', message = '', duration = 4000) {
    if (!container) {
        initNotifications();
    }
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    const colors = {
        success: 'var(--success)',
        error: 'var(--danger)',
        info: 'var(--ice-400)',
        warning: 'var(--warning)'
    };
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.borderLeft = `3px solid ${colors[type] || colors.info}`;
    
    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || 'ℹ️'}</span>
        <div class="notification-content">
            <span class="notification-title">${title}</span>
            <span class="notification-message">${message}</span>
        </div>
        <button class="notification-close" aria-label="Close notification">✕</button>
    `;
    
    container.appendChild(notification);
    
    // Close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        removeNotification(notification);
    });
    
    // Auto dismiss
    const timeout = setTimeout(() => {
        removeNotification(notification);
    }, duration);
    
    // Pause on hover
    notification.addEventListener('mouseenter', () => {
        clearTimeout(timeout);
    });
    
    notification.addEventListener('mouseleave', () => {
        setTimeout(() => {
            removeNotification(notification);
        }, duration);
    });
    
    return notification;
}

// ============================================================
// REMOVE NOTIFICATION
// ============================================================
function removeNotification(notification) {
    if (!notification || !notification.parentNode) return;
    
    notification.classList.add('hide');
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 350);
}

// ============================================================
// CLEAR ALL NOTIFICATIONS
// ============================================================
export function clearNotifications() {
    if (!container) return;
    const notifications = container.querySelectorAll('.notification');
    notifications.forEach((n) => removeNotification(n));
}