"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useWorkspace } from "./provider";
import { workspaceIdentity } from "@/lib/workspace-onboarding";
import { FormMessage, Icon, useTask } from "./ui";

export function AccountMenu({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { user, data, perspective, signOut } = useWorkspace();
  const { displayName, initials } = workspaceIdentity(user, data.profiles);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const path = usePathname();
  const task = useTask();
  const lastOnOpen = useRef(false);
  useEffect(() => {
    setOpen(false);
  }, [path, user?.id]);
  useEffect(() => {
    if (!open) return;
    const items =
      panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items?.[lastOnOpen.current ? items.length - 1 : 0]?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function keydown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      close();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      panel.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not(:disabled)',
      ) || [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[next]?.focus();
  }
  function navigate() {
    setOpen(false);
    onNavigate?.();
  }
  return (
    <div
      ref={root}
      className={`account-menu ${compact ? "account-menu-compact" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="account-trigger"
        aria-label={`Account menu for ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          lastOnOpen.current = false;
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            lastOnOpen.current = event.key === "ArrowUp";
            setOpen(true);
          }
        }}
      >
        <span className="account-avatar" aria-hidden="true">
          {initials}
        </span>
        {!compact && (
          <span className="account-identity">
            <strong>{displayName}</strong>
            <small>{user?.email}</small>
          </span>
        )}
        <svg className="account-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m5 6 3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="account-popover" ref={panel} onKeyDown={keydown}>
          <div className="account-menu-heading">
            <strong>{displayName}</strong>
            <span>{user?.email}</span>
            <small>
              {perspective === "client" ? "Client" : "Freelancer"} perspective
            </small>
          </div>
          <div id={id} role="menu" aria-label="Account actions">
            <Link
              role="menuitem"
              tabIndex={-1}
              href="/settings#profile"
              onClick={navigate}
            >
              <Icon name="user" />
              Account / Profile
            </Link>
            <Link
              role="menuitem"
              tabIndex={-1}
              href="/settings#preferences"
              onClick={navigate}
            >
              <Icon name="gear" />
              Settings
            </Link>
            <div className="account-menu-divider" role="separator" />
            <button
              role="menuitem"
              tabIndex={-1}
              disabled={task.busy}
              onClick={() =>
                void task.run(async () => {
                  await signOut();
                  setOpen(false);
                })
              }
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4" />
              </svg>
              {task.busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
          <FormMessage error={task.error} />
        </div>
      )}
    </div>
  );
}
