"use client";

import { Sidebar } from "@/components/ui/Sidebar";
import { Guard } from "@/components/ui/Guard";
import { SidebarProvider } from "@/contexts/sidebar-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Guard>
        <div className="flex h-screen overflow-hidden bg-[#061329] p-1">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-[18px] border border-slate-200 bg-[#f5f7fb] shadow-[0_0_0_1px_rgba(15,23,42,0.08)]">
            {children}
          </div>
        </div>
      </Guard>
    </SidebarProvider>
  );
}
