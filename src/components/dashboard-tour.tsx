"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { readTourPreference, saveTourPreference, tourPlacement, tourSteps, type Rect, type TourStatus } from "@/lib/guided-tour";
import type { Role } from "@/lib/types";
import { useWorkspace } from "./provider";

function storage() { try { return window.localStorage; } catch { return undefined; } }

export function DashboardTour() {
  const { user, perspective, ready, loaded, error, authError } = useWorkspace();
  const path = usePathname();
  if (!user || !ready || !loaded || error || authError || path !== "/dashboard") return null;
  return <AutomaticTour key={`${user.id}:${perspective}`} userId={user.id} perspective={perspective} />;
}

function AutomaticTour({ userId, perspective }: { userId: string; perspective: Role }) {
  const [state, setState] = useState<"checking" | "show" | "dismissed" | "unavailable">("checking");
  const [canLaunch, setCanLaunch] = useState(false);
  const dismissed = useRef(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const next = await readTourPreference(getSupabase(), userId, perspective, storage());
      if (alive && !(dismissed.current && next === "show")) setState(next);
    };
    void check();
    window.addEventListener("online", check);
    return () => { alive = false; window.removeEventListener("online", check); };
  }, [userId, perspective]);
  useEffect(() => {
    if (state !== "show" || canLaunch) return;
    const launch = () => {
      if (document.visibilityState === "visible" && !document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) setCanLaunch(true);
    };
    const observer = new MutationObserver(launch);
    observer.observe(document.body, { attributes: true, attributeFilter: ["open", "aria-modal"], childList: true, subtree: true });
    document.addEventListener("visibilitychange", launch);
    launch();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", launch); };
  }, [state, canLaunch]);
  return state === "show" && canLaunch ? <DashboardTourDialog userId={userId} perspective={perspective} onClose={() => { dismissed.current = true; setState("dismissed"); }} /> : null;
}

function visibleTarget(name: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)).find((node) => {
    const rect = node.getBoundingClientRect();
    if (!node.isConnected || rect.width < 2 || rect.height < 2 || node.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    }
    return true;
  });
}

export function DashboardTourDialog({ userId, perspective, onClose }: { userId: string; perspective: Role; onClose: () => void }) {
  const steps = tourSteps(perspective);
  const [index, setIndex] = useState(0);
  const [geometry, setGeometry] = useState<{ rect: Rect | null; left: number; top: number; found: boolean; navigation: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const locked = useRef(false);
  const mounted = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null), panel = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId(), descriptionId = useId(), maskId = useId().replaceAll(":", "");
  const step = steps[index], last = index === steps.length - 1;
  const { notice } = useWorkspace();

  useLayoutEffect(() => {
    mounted.current = true;
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const scroll = { left: window.scrollX, top: window.scrollY };
    node?.showModal();
    return () => {
      mounted.current = false;
      node?.close();
      window.scrollTo({ ...scroll, behavior: "instant" });
      if (previous?.isConnected && previous !== document.body) previous.focus({ preventScroll: true });
      else document.getElementById("workspace-main")?.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    let frame = 0, stopped = false, scrolled: HTMLElement | undefined;
    setGeometry(null);
    const measure = () => {
      if (stopped || !panel.current) return;
      const primary = step.target ? visibleTarget(step.target) : undefined;
      const navigation = !primary && ["projects", "invitations", "workflow"].includes(step.target || "") ? visibleTarget("mobile-navigation") : undefined;
      const target = primary || navigation;
      if (target && scrolled !== target) {
        target.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
        scrolled = target;
      }
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      // The dialog excludes classic scrollbars; innerWidth/100vw include them.
      const width = Math.min(viewport?.width || window.innerWidth, (dialog.current?.clientWidth || document.documentElement.clientWidth) - left);
      const height = Math.min(viewport?.height || window.innerHeight, (dialog.current?.clientHeight || window.innerHeight) - top);
      panel.current.style.maxWidth = `${Math.max(0, width - 24)}px`;
      panel.current.style.maxHeight = `${Math.max(0, height - 24)}px`;
      const bounds = target?.getBoundingClientRect();
      // Never leave a spotlight at old coordinates when a target disappears.
      const rect = bounds && bounds.bottom > top && bounds.top < top + height && bounds.right > left && bounds.left < left + width
        ? { left: Math.max(left + 4, bounds.left - 5), top: Math.max(top + 4, bounds.top - 5), width: Math.min(bounds.right + 5, left + width - 4) - Math.max(left + 4, bounds.left - 5), height: Math.min(bounds.bottom + 5, top + height - 4) - Math.max(top + 4, bounds.top - 5) } : null;
      const position = tourPlacement(rect, panel.current.getBoundingClientRect(), { width, height, left, top });
      const next = { ...position, rect, found: !step.target || !!rect, navigation: !!navigation };
      setGeometry((old) => JSON.stringify(old) === JSON.stringify(next) ? old : next);
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [index, step.target]);

  const positioned = geometry !== null;
  useLayoutEffect(() => { if (positioned) heading.current?.focus({ preventScroll: true }); }, [index, positioned]);

  async function dismiss(status: TourStatus) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setSaveError("");
    const result = await saveTourPreference(getSupabase(), userId, perspective, status, storage());
    if (!mounted.current) return;
    locked.current = false; setBusy(false);
    if (result.remote || result.local) {
      if (!result.remote) notice("Tour dismissed on this browser. Your preference will sync when the connection returns.");
      onClose();
    } else setSaveError("Your preference could not be saved. Try again, or close for now; the tour may appear on your next visit.");
  }

  return <dialog ref={dialog} className="guided-tour" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); if (!busy) void dismiss("skipped"); }}>
    <svg className="tour-shade" width="100%" height="100%" aria-hidden="true">
      <defs><mask id={maskId}><rect width="100%" height="100%" fill="white" />{geometry?.rect && <rect x={geometry.rect.left} y={geometry.rect.top} width={geometry.rect.width} height={geometry.rect.height} rx="10" fill="black" />}</mask></defs>
      <rect width="100%" height="100%" fill="rgba(13, 32, 25, .48)" mask={`url(#${maskId})`} />
      {geometry?.rect && <rect x={geometry.rect.left} y={geometry.rect.top} width={geometry.rect.width} height={geometry.rect.height} rx="10" fill="none" stroke="#d8e9dc" strokeWidth="3" />}
    </svg>
    <section ref={panel} className="tour-popover" style={{ left: geometry?.left ?? 12, top: geometry?.top ?? 12, visibility: geometry ? "visible" : "hidden" }}>
      <div className="tour-meta"><span>{perspective === "client" ? "Client" : "Freelancer"} workspace</span><span aria-live="polite">{index + 1} of {steps.length}</span></div>
      <h2 ref={heading} id={titleId} tabIndex={-1}>{step.title}</h2>
      <p id={descriptionId}>{step.description}</p>
      {geometry?.navigation && <p className="tour-unavailable">On mobile, these pages are in the navigation menu highlighted above. Open it after the tour.</p>}
      {geometry && !geometry.found && <p className="tour-unavailable" role="status">This section is not visible right now. You can wait for it to load or continue the tour.</p>}
      {saveError && <p className="formerror" role="alert">{saveError}</p>}
      <div className="tour-controls">
        <button className="ghost" disabled={busy} onClick={() => void dismiss("skipped")}>Skip</button>
        <div><button disabled={busy || index === 0} onClick={() => setIndex(index - 1)}>Back</button>
          <button className="primary" disabled={busy} onClick={() => last ? void dismiss("completed") : setIndex(index + 1)}>{busy ? "Saving…" : last ? "Finish" : "Next"}</button></div>
      </div>
      {saveError && <button className="ghost" onClick={onClose}>Close for now</button>}
    </section>
  </dialog>;
}
