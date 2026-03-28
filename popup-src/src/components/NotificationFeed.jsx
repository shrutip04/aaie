import React from 'react';
import NotificationCard from './NotificationCard.jsx';

export default function NotificationFeed({ notifications, canAct, canView, onAction }) {
  if (notifications.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '36px 20px' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1917', marginBottom: 4 }}>All clear</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>No new notifications. Stay in flow.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: '12px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b6a65', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Notifications · {notifications.length}
        </span>
        {!canAct && (
          <span style={{ fontSize: 10, color: '#d97706', background: '#fffbeb', padding: '2px 7px', borderRadius: 5, border: '1px solid #fde68a' }}>
            View only
          </span>
        )}
      </div>
      <div style={{ padding: '0 16px' }}>
        {notifications.map(n => (
          <NotificationCard
            key={n.id}
            notification={n}
            canAct={canAct}
            canView={canView}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}
