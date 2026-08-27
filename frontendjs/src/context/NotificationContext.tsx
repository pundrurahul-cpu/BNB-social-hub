import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { usePosts } from './PostsContext';
import { useClient } from './ClientContext';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { posts } = usePosts();
  const { activeClient } = useClient();

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    const newNotif: Notification = {
      ...notif,
      id: Math.random().toString(36).substr(2, 9),
      read: false,
      timestamp: new Date()
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  // System Health & Post Monitoring Logic
  useEffect(() => {
    if (!posts.length || !activeClient) return;

    const newAlerts: Omit<Notification, 'id' | 'read' | 'timestamp'>[] = [];

    // 1. Check for posts scheduled today
    const today = new Date().toDateString();
    const todayPosts = posts.filter(p => p.status === 'scheduled' && new Date(p.date).toDateString() === today);
    if (todayPosts.length > 0) {
      newAlerts.push({
        type: 'info',
        title: 'Daily Schedule',
        message: `You have ${todayPosts.length} post(s) scheduled for today for ${activeClient.name}.`
      });
    }

    // 2. Check for missing media in scheduled posts
    const missingMedia = posts.filter(p => p.status === 'scheduled' && !p.mediaUrl && !p.file);
    if (missingMedia.length > 0) {
      newAlerts.push({
        type: 'warning',
        title: 'Missing Media Alert',
        message: `${missingMedia.length} scheduled post(s) are missing images/video. Please upload media.`
      });
    }

    // 3. Check for recently failed posts
    const failedPosts = posts.filter(p => p.status === 'failed');
    if (failedPosts.length > 0) {
      newAlerts.push({
        type: 'error',
        title: 'Publishing Failure',
        message: `${failedPosts.length} post(s) failed to publish. Check your connections.`
      });
    }

    // Only add if they are "new" alerts (basic deduplication by message)
    setNotifications(prev => {
      const filteredNew = newAlerts.filter(na => !prev.some(p => p.message === na.message));
      if (filteredNew.length === 0) return prev;

      const formattedNew = filteredNew.map(na => ({
        ...na,
        id: Math.random().toString(36).substr(2, 9),
        read: false,
        timestamp: new Date()
      }));

      return [...formattedNew, ...prev].slice(0, 50);
    });

  }, [posts, activeClient]);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
