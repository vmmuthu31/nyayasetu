"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} });

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Persist preference
  useEffect(() => {
    const stored = localStorage.getItem("ns_sidebar_collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggle = () =>
    setCollapsed((v) => {
      localStorage.setItem("ns_sidebar_collapsed", String(!v));
      return !v;
    });

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
