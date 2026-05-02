"use client";

import { Sidebar } from "@/components/ui/Sidebar";
import { Guard } from "@/components/ui/Guard";
import { SidebarProvider } from "@/contexts/sidebar-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Guard>
        <div className="flex h-screen overflow-hidden bg-slate-50">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {children}
          </div>
        </div>
      </Guard>
    </SidebarProvider>
  );
}
