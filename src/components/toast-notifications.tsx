"use client";
import { useEffect, useState, useRef } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { toastEvent, type Toast } from "@/lib/client-api";
export function ToastNotifications() {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const activeTimers = timers.current;
    const listener = (event: Event) => {
      const item = (event as CustomEvent<Toast>).detail;
      setItems((current) => [...current.slice(-3), item]);
      const timer = setTimeout(() => {
        setItems((current) => current.filter((v) => v.id !== item.id));
        activeTimers.delete(timer);
      }, 6500);
      activeTimers.add(timer);
    };
    window.addEventListener(toastEvent, listener);
    return () => {
      window.removeEventListener(toastEvent, listener);
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, []);
  return (
    <aside className="toast-stack" aria-label="Change notifications">
      {items.map((item) => (
        <div
          className={"toast-popup " + item.kind}
          key={item.id}
          role={item.kind === "error" ? "alert" : "status"}
        >
          {item.kind === "error" ? (
            <AlertCircle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <p>{item.message}</p>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() =>
              setItems((current) => current.filter((v) => v.id !== item.id))
            }
          >
            <X size={17} />
          </button>
        </div>
      ))}
    </aside>
  );
}
