"use client";

import { io, Socket } from "socket.io-client";
import { create } from "zustand";

import { useAuthStore } from "./authStore";

type SocketState = {
  socket: Socket | null;
  isConnected: boolean;
  token: string | null;
  connect: () => Socket | null;
  disconnect: () => void;
};

const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  token: null,
  connect: () => {
    if (typeof window === "undefined") {
      return null;
    }

    const existingSocket = get().socket;
    const currentToken = useAuthStore.getState().token;

    if (!currentToken || !socketUrl) {
      return null;
    }

    if (existingSocket && get().token && get().token !== currentToken) {
      existingSocket.disconnect();
      set({ socket: null, isConnected: false, token: null });
    }

    const socketAfterReset = get().socket;
    if (socketAfterReset) {
      if (!socketAfterReset.connected) {
        socketAfterReset.connect();
      }
      return socketAfterReset;
    }

    const socket = io(socketUrl, {
      transports: ["websocket"],
      auth: {
        token: currentToken,
      },
    });

    socket.on("connect", () => {
      set({ isConnected: true });
    });

    socket.on("disconnect", () => {
      set({ isConnected: false });
    });

    set({
      socket,
      isConnected: socket.connected,
      token: currentToken,
    });

    return socket;
  },
  disconnect: () => {
    const socket = get().socket;

    if (!socket) {
      return;
    }

    socket.disconnect();
    set({
      socket: null,
      isConnected: false,
      token: null,
    });
  },
}));
