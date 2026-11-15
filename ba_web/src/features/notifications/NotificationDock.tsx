'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineInfoCircle,
  AiOutlineWarning,
  AiOutlineClose,
} from 'react-icons/ai';
import type { Notification, NotificationType } from './NotificationContext';

interface NotificationDockProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'success':
      return <AiOutlineCheckCircle />;
    case 'error':
      return <AiOutlineCloseCircle />;
    case 'warning':
      return <AiOutlineWarning />;
    case 'join':
      return <span>✓</span>;
    case 'leave':
      return <span>✗</span>;
    case 'info':
    default:
      return <AiOutlineInfoCircle />;
  }
}

export function NotificationDock({ notifications, onRemove }: NotificationDockProps) {
  return (
    <motion.div
      className={`notification-dock${notifications.length > 0 ? ' visible' : ''}`}
      initial={{ opacity: 0, y: -20 }}
      animate={notifications.length > 0 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      style={{ pointerEvents: notifications.length > 0 ? 'auto' : 'none' }}
    >
      {notifications.length > 0 && (
        <>
          <div className="notification-dock-header">
            <span className="notification-dock-title">Notifications</span>
            <button
              className="notification-dock-close-all"
              type="button"
              onClick={() => notifications.forEach((n) => onRemove(n.id))}
              aria-label="Close all notifications"
            >
              ✕
            </button>
          </div>
          <div className="notification-dock-content">
            <AnimatePresence mode="popLayout">
              {notifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  className={`notification-item notification-item-${notif.type}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  <span className="notification-item-icon">
                    {getNotificationIcon(notif.type)}
                  </span>
                  <div className="notification-item-content">
                    {notif.title && (
                      <strong className="notification-item-title">{notif.title}</strong>
                    )}
                    <p className="notification-item-message">{notif.message}</p>
                  </div>
                  {notif.dismissible && (
                    <button
                      className="notification-item-close"
                      type="button"
                      onClick={() => onRemove(notif.id)}
                      aria-label="Dismiss notification"
                    >
                      <AiOutlineClose />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </motion.div>
  );
}
