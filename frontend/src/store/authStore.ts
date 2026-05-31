"use client";

import { create } from "zustand";

const AUTH_STORAGE_KEY = "kanban.auth";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string | null;
}

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setAuth: (token: string, user?: Partial<AuthUser> | null) => void;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  hydrate: () => void;
  logout: () => void;
};

type PersistedAuth = {
  token: string | null;
  user: AuthUser | null;
};

const initialAuth = readPersistedAuth();

function readPersistedAuth(): PersistedAuth {
  if (typeof window === "undefined") {
    return { token: null, user: null };
  }

  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawValue) {
    return { token: null, user: null };
  }

  try {
    return JSON.parse(rawValue) as PersistedAuth;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return { token: null, user: null };
  }
}

function persistAuth(value: PersistedAuth): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
}

function clearPersistedAuth(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function decodeJwtUser(token: string): AuthUser | null {
  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return null;
    }

    const decodedPayload = JSON.parse(atob(payload)) as {
      sub?: string;
      email?: string;
    };

    if (!decodedPayload.sub) {
      return null;
    }

    return {
      id: decodedPayload.sub,
      email: decodedPayload.email ?? "",
    };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initialAuth.token,
  user: initialAuth.user,
  hydrated: typeof window !== "undefined",
  setAuth: (token, user) => {
    const decodedUser = decodeJwtUser(token);
    const nextUser = decodedUser
      ? {
          ...decodedUser,
          ...user,
        }
      : (user as AuthUser | null | undefined) ?? null;

    persistAuth({ token, user: nextUser ?? null });
    set({ token, user: nextUser ?? null, hydrated: true });
  },
  setToken: (token) => {
    const currentUser = get().user;

    if (!token) {
      clearPersistedAuth();
      set({ token: null, user: null, hydrated: true });
      return;
    }

    const decodedUser = decodeJwtUser(token);
    const nextUser = decodedUser
      ? {
          ...decodedUser,
          ...currentUser,
        }
      : currentUser;

    persistAuth({ token, user: nextUser });
    set({ token, user: nextUser, hydrated: true });
  },
  setUser: (user) => {
    const token = get().token;
    persistAuth({ token, user });
    set({ user, hydrated: true });
  },
  hydrate: () => {
    const persisted = readPersistedAuth();
    set({
      token: persisted.token,
      user: persisted.user,
      hydrated: true,
    });
  },
  logout: () => {
    clearPersistedAuth();
    set({
      token: null,
      user: null,
      hydrated: true,
    });
  },
}));
