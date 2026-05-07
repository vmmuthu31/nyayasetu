"use client";

import {
  createContext,
  useContext,
  useEffect,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function Dialog({
  children,
  onOpenChange,
  open,
}: PropsWithChildren<DialogContextValue>) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const context = useDialogContext();

  useEffect(() => {
    if (!context.open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") context.onOpenChange(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [context]);

  if (!context.open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        onClick={() => context.onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full max-w-[560px] rounded-xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.18)]",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => context.onOpenChange(false)}
          className="absolute right-4 top-4 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({ children }: PropsWithChildren) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

export function DialogTitle({ children }: PropsWithChildren) {
  return <h2 className="text-lg font-semibold text-slate-950">{children}</h2>;
}

export function DialogDescription({ children }: PropsWithChildren) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

export function DialogFooter({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("mt-6 flex items-center justify-end gap-3", className)}>{children}</div>;
}

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within Dialog");
  }
  return context;
}
