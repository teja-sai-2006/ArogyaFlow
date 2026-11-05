import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, DemoUser, RealtimeNotification } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  demoUsers: DemoUser[];
  notifications: RealtimeNotification[];
  wsConnected: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  switchUser: (demoUser: DemoUser) => Promise<void>;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('arogya_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('arogya_token');
  });
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Fetch demo users for the quick switcher
  useEffect(() => {
    fetch('/api/auth/demo-users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDemoUsers(data);
      })
      .catch(err => console.error("Could not fetch demo users:", err));
  }, []);

  // Connect WebSocket when user is present
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      role: user.role,
      org_id: user.org_id || '',
      uhid: user.uhid || ''
    });
    // Connect to WebSocket: port 8000 in Vite dev, or current host in production
    const isViteDev = window.location.port === '5173';
    const host = isViteDev ? `${window.location.hostname}:8000` : window.location.host;
    const wsUrl = `${protocol}//${host}/ws?${params.toString()}`;

    let socket: WebSocket | null = null;
    let pingInterval: number | null = null;

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setWsConnected(true);
        pingInterval = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send("ping");
          }
        }, 20000);
      };

      socket.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const payload = JSON.parse(event.data);
          const newNotif: RealtimeNotification = {
            id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            event: payload.event,
            title: formatEventTitle(payload.event),
            message: formatEventMessage(payload.event, payload.data),
            data: payload.data,
            timestamp: new Date().toLocaleTimeString(),
            read: false
          };
          setNotifications(prev => [newNotif, ...prev]);
        } catch (e) {
          console.error("Error parsing WS message:", e);
        }
      };

      socket.onclose = () => setWsConnected(false);
      socket.onerror = () => setWsConnected(false);
    } catch (e) {
      console.error("WebSocket init error:", e);
    }

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (socket) socket.close();
    };
  }, [user]);

  const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...options, headers });
  };

  const login = async (email: string, password: string = "pass123"): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) return false;
      const data = await res.json();
      setUser(data.user);
      setToken(data.access_token);
      localStorage.setItem('arogya_user', JSON.stringify(data.user));
      localStorage.setItem('arogya_token', data.access_token);
      return true;
    } catch (e) {
      console.error("Login failed:", e);
      return false;
    }
  };

  const switchUser = async (demoUser: DemoUser) => {
    await login(demoUser.email, "pass123");
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('arogya_user');
    localStorage.removeItem('arogya_token');
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        demoUsers,
        notifications,
        wsConnected,
        login,
        logout,
        switchUser,
        markNotificationRead,
        clearNotifications,
        apiFetch
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

function formatEventTitle(event: string): string {
  switch (event) {
    case 'EMERGENCY_SOS_ALERT': return '🚨 EMERGENCY SOS ALERT';
    case 'DOCTOR_ABSENCE_ALERT': return '⚠️ Doctor Marked Absent';
    case 'NEW_APPOINTMENT_REQUEST': return '📅 New AI Appointment Request';
    case 'LAB_REPORT_COMPLETED': return '🔬 Lab Scan Uploaded';
    case 'GENERIC_REQUEST_DECISION': return '💊 Generic Replacement Decision';
    case 'REGIONAL_DISASTER_ALERT': return '🌪️ Regional Disaster Warning';
    case 'DISASTER_TRANSFER_INCOMING': return '🚑 Disaster Patient Evacuation Transfer';
    case 'SMS_DISPATCHED_BATCH': return '📱 Offline SMS Broadcast Dispatched';
    case 'BLOOD_ORDER_RECEIVED': return '🩸 Emergency Blood Order Received';
    default: return `⚡ Real-Time Update: ${event}`;
  }
}

function formatEventMessage(event: string, data: any): string {
  if (!data) return "Real-time state change detected.";
  if (event === 'EMERGENCY_SOS_ALERT') {
    return `Critical patient ${data.patient_name} (${data.blood_group}) en route! Assigned: ${data.assigned_hospital?.name}. ${data.blood_status_message || ''}`;
  }
  if (event === 'DOCTOR_ABSENCE_ALERT') {
    return `${data.doctor_name} is marked Absent. ${data.flagged_count} appointment(s) flagged for immediate reassignment.`;
  }
  if (event === 'REGIONAL_DISASTER_ALERT') {
    return `${data.alert_title} in ${data.affected_city}. ${data.sms_broadcast_count} SMS alerts dispatched to patients low on refills.`;
  }
  if (event === 'DISASTER_TRANSFER_INCOMING') {
    return `Receiving ${data.patients?.length || 0} critical patients evacuated from ${data.source_hospital?.name}. Full clinical charts cloned.`;
  }
  return typeof data === 'string' ? data : JSON.stringify(data);
}
