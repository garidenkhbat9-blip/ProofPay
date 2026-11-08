"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { errorMessage } from "@/lib/cloud";
export function Icon({ name = "folder" }: { name?: string }) {
  const paths: Record<string, string> = {
    shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3M8 12l3 3 5-6",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    folder: "M3 7V5h6l2 2h10v13H3z",
    report: "M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5",
    wallet: "M3 6h17v14H3zM3 6l13-3v3M15 11h6v5h-6z",
    link: "M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2M14 11a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2",
    gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
    menu: "M4 6h16M4 12h16M4 18h16",
    compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M16 8l-3 5-5 3 3-5z",
    close: "m6 6 12 12M6 18 18 6",
    plus: "M12 5v14M5 12h14",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    "eye-off":
      "m3 3 18 18M10 5.2A12 12 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 3.8M6.3 6.3A19 19 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.7-1.7M10 10a3 3 0 0 0 4 4",
    check: "M5 12l5 5L20 7",
    user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    briefcase:
      "M20 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1ZM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2",
  };
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] ?? paths.folder} />
    </svg>
  );
}
export function Heading({
  title,
  subtitle,
  children,
  level: Title = "h1",
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  level?: "h1" | "h2";
}) {
  return (
    <div className="heading">
      <div>
        <Title>{title}</Title>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="status">
      {children}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="card empty">{children}</div>;
}
export function EmptyState({ icon = "folder", title, description, children }: {
  icon?: string; title: string; description: string; children?: ReactNode;
}) {
  return <section className="workflow-empty"><span className="workflow-empty-icon"><Icon name={icon} /></span>
    <div><h2>{title}</h2><p>{description}</p>{children && <div className="actions">{children}</div>}</div></section>;
}
export function Badge({
  children,
  status = "",
}: {
  children: ReactNode;
  status?: string;
}) {
  return <span className={`delivery-pill ${status}`}>{children}</span>;
}
export function Modal({
  title,
  onClose,
  children,
  className,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
    const node = ref.current;
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(e) => {
        if (!busy && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialoghead">
        <h2 id={titleId}>{title}</h2>
        <button className="ghost" aria-label="Close dialog" disabled={busy} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function useTask() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false);
  async function run(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run, clearError: () => setError("") };
}
export function FormMessage({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p className="formerror" role="alert">
      {error}
    </p>
  );
}
