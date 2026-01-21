'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Socket } from 'socket.io-client';
import { createAdminSocket } from './socket';
import { useAppStore } from '@/store/useAppStore';

type AdminSocketContextType = {
  socket: Socket | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastEvent?: { name: string; data: unknown };
};

const AdminSocketContext = createContext<AdminSocketContextType>({ socket: null, status: 'disconnected' });

export function AdminSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<AdminSocketContextType['status']>('disconnected');
  const [lastEvent, setLastEvent] = useState<{ name: string; data: unknown }>();
  const [token, setToken] = useState<string | null>(null);
  const addNotification = useAppStore((state) => state.addNotification);

  useEffect(() => {
    const readToken = () => {
      const next = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      setToken(next);
    };
    readToken();
    window.addEventListener('storage', readToken);
    window.addEventListener('auth-token-changed', readToken);
    window.addEventListener('focus', readToken);
    return () => {
      window.removeEventListener('storage', readToken);
      window.removeEventListener('auth-token-changed', readToken);
      window.removeEventListener('focus', readToken);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus('disconnected');
      setSocket((prev) => {
        if (prev) prev.disconnect();
        return null;
      });
      return;
    }
    setStatus('connecting');
    const s = createAdminSocket(token);
    setSocket(s);

    const syncStatus = () => {
      if (s.connected) {
        setStatus('connected');
      } else {
        setStatus((prev) => (prev === 'connected' ? 'connecting' : prev));
      }
    };

    s.on('connect', () => setStatus('connected'));
    s.on('reconnect', () => setStatus('connected'));
    s.on('reconnect_attempt', () => setStatus('connecting'));
    s.on('disconnect', () => setStatus('disconnected'));
    s.on('connect_error', () => {
      setStatus('error');
      addNotification({
        type: 'error',
        title: 'Tiempo real no disponible',
        message: 'No se pudo conectar al servidor en vivo.',
      });
    });

    s.on('status', (d) => setLastEvent({ name: 'status', data: d }));
    s.on('productos.updated', (d) => {
      setLastEvent({ name: 'productos.updated', data: d });
      addNotification({
        type: 'info',
        title: 'Productos actualizados',
        message: 'Se recibieron cambios en el catálogo.',
      });
    });
    s.on('pedidos.updated', (d) => {
      setLastEvent({ name: 'pedidos.updated', data: d });
      addNotification({
        type: 'info',
        title: 'Pedidos actualizados',
        message: 'Se recibieron cambios en pedidos.',
      });
    });
    s.on('cotizaciones.updated', (d) => {
      setLastEvent({ name: 'cotizaciones.updated', data: d });
      addNotification({
        type: 'info',
        title: 'Cotizaciones actualizadas',
        message: 'Se recibieron cambios en cotizaciones.',
      });
    });

    const intervalId = window.setInterval(syncStatus, 1500);
    syncStatus();

    return () => {
      window.clearInterval(intervalId);
      s.disconnect();
    };
  }, [token, addNotification]);

  const value = useMemo(() => ({ socket, status, lastEvent }), [socket, status, lastEvent]);
  return <AdminSocketContext.Provider value={value}>{children}</AdminSocketContext.Provider>;
}

export function useAdminSocket() {
  return useContext(AdminSocketContext);
}
