"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, User, RegisterData } from "./api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function saveSession(token: string, user: User) {
  localStorage.setItem("ns_token", token);
  localStorage.setItem("ns_user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("ns_token");
  localStorage.removeItem("ns_user");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("ns_token");
    const u = localStorage.getItem("ns_user");
    if (t && u) {
      try {
        setToken(t);
        setUser(JSON.parse(u));
      } catch {
        clearSession();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    saveSession(res.access_token, res.user);
    setToken(res.access_token);
    setUser(res.user);
    router.push("/dashboard");
  };

  const register = async (data: RegisterData) => {
    const res = await api.auth.register(data);
    saveSession(res.access_token, res.user);
    setToken(res.access_token);
    setUser(res.user);
    router.push("/dashboard");
  };

  const logout = () => {
    clearSession();
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
