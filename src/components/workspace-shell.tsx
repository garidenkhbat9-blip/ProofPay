"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useWorkspace } from "./provider";
import { Icon, Empty } from "./ui";
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const {
      user,
      ready,
      loading,
      loaded,
      error,
      authError,
      perspective,
      setPerspective,
      refresh,
      sync,
    } = useWorkspace(),
    path = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!mobile || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled)",
        ) || [],
      );
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const items = controls(),
        first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
      menuButton.current?.focus();
    };
  }, [open, mobile]);
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const check = () => {
      if (alive && document.visibilityState === "visible" && navigator.onLine)
        void sync();
    };
    // No Realtime publication is assumed. Poll only an open, visible workspace.
    const interval = setInterval(check, 30000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    check();
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [user?.id, sync]);
  useEffect(() => {
    if (ready && !user && !authError) {
      const next = path + window.location.search;
      try {
        sessionStorage.setItem("proofpay-next", next);
      } catch {}
      router.replace("/login?next=" + encodeURIComponent(next));
    }
  }, [ready, user, authError, path, router]);
  if (!ready || (!user && !authError))
    return (
      <main className="authloading" role="status">
        Loading your workspace…
      </main>
    );
  if (authError)
    return (
      <main className="standalone">
        <h1>Connection setup required</h1>
        <p>{authError}</p>
        <Link href="/">Back to home</Link>
      </main>
    );
  if (!user) return null;
  const name =
    user.user_metadata.full_name || user.email?.split("@")[0] || "Account";
  const clientNav = [
    ["/dashboard", "grid", "Overview"],
    ["/projects", "folder", "Projects"],
    ["/reviews", "report", "Reviews"],
    ["/agreements", "report", "Agreements"],
    ["/invitations", "link", "Invitations"],
    ["/payments", "wallet", "Payments"],
    ["/activity", "clock", "Activity"],
  ];
  const freelancerNav = [
    ["/dashboard", "grid", "Overview"],
    ["/projects", "folder", "My jobs"],
    ["/reviews", "report", "Submissions"],
    ["/agreements", "report", "Agreements"],
    ["/invitations", "link", "Invitations"],
    ["/payments", "wallet", "Earnings"],
    ["/activity", "clock", "Activity"],
  ];
  const nav = perspective === "client" ? clientNav : freelancerNav;
  return (
    <>
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      {mobile && open && (
        <div
          className="workspace-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        id="workspace-navigation"
        ref={sidebar}
        className={`sidebar ${open ? "open" : ""}`}
        inert={mobile && !open}
        role={mobile && open ? "dialog" : undefined}
        aria-modal={mobile && open ? true : undefined}
        aria-label="Workspace navigation"
      >
        <Link className="brand" href="/dashboard" onClick={() => setOpen(false)}>
          <span className="brandmark">
            <Image src="/logo.png" alt="ProofPay logo" width={38} height={38} />
          </span>
          ProofPay
        </Link>
        <div className="workspace">
          <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <div className="perspective-switcher">
          <button
            aria-pressed={perspective === "client"}
            className={`perspective-btn ${perspective === "client" ? "active" : ""}`}
            onClick={() => {
              setOpen(false);
              setPerspective("client");
              router.push("/dashboard");
            }}
          >
            Client
          </button>
          <button
            aria-pressed={perspective === "freelancer"}
            className={`perspective-btn ${perspective === "freelancer" ? "active" : ""}`}
            onClick={() => {
              setOpen(false);
              setPerspective("freelancer");
              router.push("/dashboard");
            }}
          >
            Freelancer
          </button>
        </div>
        {nav.map(([href, icon, title]) => (
          <Link
            key={href}
            className={`nav ${path === href || path.startsWith(href + "/") ? "active" : ""}`}
            href={href}
            aria-current={
              path === href || path.startsWith(href + "/") ? "page" : undefined
            }
            onClick={() => setOpen(false)}
          >
            <Icon name={icon} />
            {title}
          </Link>
        ))}
        <div className="sidebottom">
          <Link
            className={`nav ${path === "/judge-workspace" ? "active" : ""}`}
            href="/judge-workspace"
            aria-current={path === "/judge-workspace" ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <Icon name="shield" />
            Judge guide
          </Link>
          <Link className="nav" href="/settings" onClick={() => setOpen(false)}>
            <Icon name="gear" />
            Settings
          </Link>
          <div className="user">
            <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{name}</strong>
              <small>{user.email}</small>
            </div>
            <button
              className="ghost mobileclose"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
      </aside>
      <main className="main" inert={mobile && open}>
        <header className="topbar">
          <div className="crumb">
            <button
              ref={menuButton}
              className="ghost mobiletoggle"
              onClick={() => setOpen(!open)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="workspace-navigation"
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <b>
              {path === "/judge-workspace"
                ? "Judge guide"
                : path.startsWith("/handoff")
                  ? "Delivery"
                  : nav.find(([href]) => path.startsWith(href))?.[2] ||
                    "Settings"}
            </b>
          </div>
          <div className="topright">
            <span className="tag">
              <i className="dot" />
              {perspective === "client" ? "Client" : "Freelancer"}
            </span>
          </div>
        </header>
        <div className="content" id="workspace-main" tabIndex={-1}>
          {!loaded && loading && (
            <div className="workspace-loading" role="status">
              <span>Loading your projects…</span>
              <div className="skeleton-grid" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
          {error && (
            <Empty>
              <h2>
                {loaded
                  ? "Could not refresh workspace"
                  : "Could not load workspace"}
              </h2>
              <p>{error}</p>
              <button onClick={() => void refresh()}>Retry</button>
            </Empty>
          )}
          {loaded && <Fragment key={user.id}>{children}</Fragment>}
          <footer className="footer">
            <Link href="/">ProofPay · Back to homepage ↗</Link>
          </footer>
        </div>
      </main>
    </>
  );
}
