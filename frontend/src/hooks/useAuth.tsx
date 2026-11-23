import axios from "axios";
import { createContext, useContext, useState, useEffect, useCallback } from "react";

const apiOrigin = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * Shared authentication context contract exposed to consumers.
 */
interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  refreshToken: string | null;
  setRefreshToken: (refreshToken: string | null) => void;
  user: {
    id?: number;
    username?: string;
    email?: string;
    isAdmin?: boolean;
    createdAt?: string;
  } | null;
  setUser: (
    user: {
      id?: number;
      username?: string;
      email?: string;
      isAdmin?: boolean;
      createdAt?: string;
    } | null,
  ) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provides authentication state and persistence logic for the app tree.
 *
 * Side effects:
 * - Persists access token, refresh token, and user payload in `localStorage`.
 * - Listens for `auth:session-expired` and `auth:tokens-updated` browser events.
 *
 * @param children Descendant React nodes that consume auth context.
 * @returns Context provider wrapping the supplied children.
 */
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    localStorage.getItem("refreshToken"),
  );
  const [user, setUser] = useState<AuthContextType["user"]>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    } else {
      localStorage.removeItem("refreshToken");
    }
  }, [refreshToken]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  useEffect(() => {
    const onSessionExpired = () => {
      setToken(null);
      setRefreshToken(null);
      setUser(null);
    };
    const onTokensUpdated = (e: Event) => {
      const d = (e as CustomEvent<{ token: string; refreshToken: string }>).detail;
      if (d?.token) setToken(d.token);
      if (d?.refreshToken) setRefreshToken(d.refreshToken);
    };
    window.addEventListener("auth:session-expired", onSessionExpired);
    window.addEventListener("auth:tokens-updated", onTokensUpdated as EventListener);
    return () => {
      window.removeEventListener("auth:session-expired", onSessionExpired);
      window.removeEventListener("auth:tokens-updated", onTokensUpdated as EventListener);
    };
  }, []);

  const logout = useCallback(async () => {
    const rt = localStorage.getItem("refreshToken");
    if (rt) {
      try {
        await axios.post(`${apiOrigin}/auth/logout`, { refreshToken: rt });
      } catch {
        /* still clear local session if the server is unreachable */
      }
    }
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, setToken, refreshToken, setRefreshToken, user, setUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Returns the current authentication context.
 *
 * @returns Auth state and mutators for token/user/session lifecycle.
 * @throws {Error} Thrown when called outside `AuthProvider`.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export default AuthProvider;
