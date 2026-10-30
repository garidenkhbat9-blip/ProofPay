"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
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
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" href="/dashboard">
          <span className="brandmark">
            <Icon name="shield" />
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
            className={`perspective-btn ${perspective === "client" ? "active" : ""}`}
            onClick={() => {
              setPerspective("client");
              router.push("/dashboard");
            }}
          >
            Client
          </button>
          <button
            className={`perspective-btn ${perspective === "freelancer" ? "active" : ""}`}
            onClick={() => {
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
            onClick={() => setOpen(false)}
          >
            <Icon name={icon} />
            {title}
          </Link>
        ))}
        <div className="sidebottom">
          <Link className="nav" href="/settings">
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
      <main className="main">
        <header className="topbar">
          <div className="crumb">
            <button
              className="ghost mobiletoggle"
              onClick={() => setOpen(!open)}
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <b>
              {path.startsWith("/handoff")
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
        <div className="content">
          {!loaded && loading && (
            <div className="empty" role="status">
              Loading your projects…
            </div>
          )}
          {error && (
            <Empty>
              <h2>{loaded ? "Could not refresh workspace" : "Could not load workspace"}</h2>
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
