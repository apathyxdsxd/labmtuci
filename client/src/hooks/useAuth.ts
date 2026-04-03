import { useEffect, useState } from "react";

export interface AuthUser {
  id: number;
  username: string;
  name: string | null;
  role: "student" | "teacher" | "admin";
  email: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number; // Unix ms timestamp
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setTokens(stored.tokens);
      setUser(stored.user);
    }
    setIsLoading(false);
  }, []);

  const login = (tokens: AuthTokens, user: AuthUser) => {
    saveToStorage(tokens, user);
    setTokens(tokens);
    setUser(user);
  };

  const updateTokens = (tokens: AuthTokens) => {
    const storedUser = loadFromStorage()?.user ?? null;
    if (storedUser) saveToStorage(tokens, storedUser);
    setTokens(tokens);
  };

  const logout = async () => {
    const stored = loadFromStorage();
    // Revoke refresh token on server (fire-and-forget)
    if (stored?.tokens.refreshToken) {
      try {
        await fetch("/api/trpc/auth.logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ "0": { refreshToken: stored.tokens.refreshToken } }),
        });
      } catch {
        // Ignore network errors during logout
      }
    }
    clearStorage();
    setTokens(null);
    setUser(null);
  };

  return {
    user,
    tokens,
    isLoading,
    isAuthenticated: !!tokens?.accessToken,
    login,
    logout,
    updateTokens,
    // Convenience getter kept for backward compat
    token: tokens?.accessToken ?? null,
  };
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function saveToStorage(tokens: AuthTokens, user: AuthUser) {
  localStorage.setItem("accessToken", tokens.accessToken);
  localStorage.setItem("refreshToken", tokens.refreshToken);
  localStorage.setItem("accessTokenExpiresAt", String(tokens.accessTokenExpiresAt));
  localStorage.setItem("user", JSON.stringify(user));
  // Keep legacy "token" key for any code that still reads it
  localStorage.setItem("token", tokens.accessToken);
}

function loadFromStorage(): { tokens: AuthTokens; user: AuthUser } | null {
  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");
  const expiresAt = localStorage.getItem("accessTokenExpiresAt");
  const userStr = localStorage.getItem("user");
  if (!accessToken || !refreshToken || !expiresAt || !userStr) return null;
  return {
    tokens: {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: Number(expiresAt),
    },
    user: JSON.parse(userStr),
  };
}

function clearStorage() {
  ["accessToken", "refreshToken", "accessTokenExpiresAt", "user", "token"].forEach(k =>
    localStorage.removeItem(k),
  );
}
