'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'join' | 'leave';

export type Notification = {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  duration?: number;
  dismissible?: boolean;
};

type NotificationContextType = {
  notifications: Notification[];
  addNotification: (
    message: string,
    type?: NotificationType,
    options?: Partial<Notification>
  ) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (message: string, type: NotificationType = 'info', options: Partial<Notification> = {}) => {
      const id = `${Date.now()}-${Math.random()}`;
      const duration = options.duration ?? (type === 'error' ? 6000 : 4000);
      const dismissible = options.dismissible ?? type !== 'join' && type !== 'leave';

      const notification: Notification = {
        id,
        type,
        message,
        title: options.title,
        duration,
        dismissible,
        ...options,
      };

      setNotifications((prev) => [...prev, notification]);

      if (duration > 0) {
        const timerId = window.setTimeout(() => {
          removeNotification(id);
        }, duration);

        return id;
      }

      return id;
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
