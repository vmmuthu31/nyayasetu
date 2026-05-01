import { Sidebar } from "@/components/ui/Sidebar";
import { Guard } from "@/components/ui/Guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard>
      <div className="flex h-full">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-slate-50">
          {children}
        </main>
      </div>
    </Guard>
  );
}
