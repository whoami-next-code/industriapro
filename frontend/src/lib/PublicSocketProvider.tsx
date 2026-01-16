"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "@/lib/api";

type PublicSocketContextType = {
  socket: Socket | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  lastEvent?: { name: string; data: any };
};

const PublicSocketContext = createContext<PublicSocketContextType>({ socket: null, status: "disconnected" });

export function PublicSocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<PublicSocketContextType["status"]>("disconnected");
  const [lastEvent, setLastEvent] = useState<{ name: string; data: any }>();

  useEffect(() => {
    setStatus("connecting");
    const s = io(`${API_URL}/ws/public`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    setSocket(s);
    s.on("connect", () => setStatus("connected"));
    s.on("disconnect", () => setStatus("disconnected"));
    s.on("connect_error", () => setStatus("error"));
    s.on("productos.updated", (d) => setLastEvent({ name: "productos.updated", data: d }));
    s.on("pedidos.updated", (d) => setLastEvent({ name: "pedidos.updated", data: d }));
    s.on("cotizaciones.updated", (d) => setLastEvent({ name: "cotizaciones.updated", data: d }));
    return () => {
      s.disconnect();
    };
  }, []);

  const value = useMemo(() => ({ socket, status, lastEvent }), [socket, status, lastEvent]);
  return <PublicSocketContext.Provider value={value}>{children}</PublicSocketContext.Provider>;
}

export function usePublicSocket() {
  return useContext(PublicSocketContext);
}
