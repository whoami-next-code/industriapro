import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

export function createAdminSocket(token: string): Socket {
  const baseUrl = API_URL.replace(/\/api\/?$/, '');
  return io(`${baseUrl}/ws/admin`, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    query: { token },
  });
}

