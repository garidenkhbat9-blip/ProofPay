"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { errorMessage, loadCloud } from "@/lib/cloud";
import { emptyCloud, type CloudData, type Role } from "@/lib/types";
import { legacyPath } from "@/lib/domain";
import { accountPerspective, perspectiveKey, createRefreshQueue } from "@/lib/workspace-sync";
import { useRouter } from "next/navigation";
interface Workspace {
  user: User | null;
  ready: boolean;
  loading: boolean;
  loaded: boolean;
  error: string;
  authError: string;
  recovery: boolean;
  data: CloudData;
  perspective: Role;
  setPerspective: (role: Role) => void;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  notice: (text: string) => void;
  signOut: () => Promise<void>;
}
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [authError, setAuthError] = useState(""),
    [recovery, setRecovery] = useState(false),
    [data, setData] = useState<CloudData>(emptyCloud),
    [perspective, setView] = useState<Role>("client"),
    [message, setMessage] = useState("");
  const identity = useRef<string | null>(null),
    epoch = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<ReturnType<typeof createRefreshQueue> | null>(null);
  const router = useRouter();
  const refresh = useCallback(() => queue.current?.request() ?? Promise.resolve(), []);
  const sync = useCallback(() => queue.current?.request(false) ?? Promise.resolve(), []);
  useEffect(() => {
    const id = user?.id;
    if (!id) return;
    const generation = epoch.current;
    let alive = true;
    const current = () => alive && generation === epoch.current && id === identity.current;
    const loader = createRefreshQueue(async () => {
      if (!current()) return;
      setLoading(true);
      try {
        const next = await loadCloud(getSupabase());
        if (current()) {
          setData(next);
          setLoaded(true);
          setError("");
        }
      } catch (e) {
        if (current()) setError(errorMessage(e));
      } finally {
        if (current()) setLoading(false);
      }
    });
    queue.current = loader;
    void loader.request();
    return () => {
      alive = false;
      loader.dispose();
      if (queue.current === loader) queue.current = null;
    };
  }, [user?.id]);
  const notice = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 5000);
  }, []);
  useEffect(() => {
    let alive = true;
    let unsubscribe = () => {};
    const legacy = legacyPath(window.location.hash);
    if (legacy) router.replace(legacy);
    const syncIdentity = (next: User | null) => {
      if (!alive) return;
      const changed = identity.current !== (next?.id ?? null);
      if (changed) {
        ++epoch.current;
        queue.current?.dispose();
        queue.current = null;
        setData(emptyCloud());
        setLoaded(false);
        setError("");
        setRecovery(false);
        setMessage("");
        setLoading(!!next);
        let stored: string | null = null;
        try { if (next) stored = localStorage.getItem(perspectiveKey(next.id)); } catch {}
        setView(accountPerspective(stored, next?.user_metadata?.preferred_workspace));
      }
      identity.current = next?.id ?? null;
      setUser(next);
      setReady(true);
      setAuthError("");
    };
    try {
      const client = getSupabase();
      let authEvent = false;
      const { data: listener } = client.auth.onAuthStateChange(
        (event, session) => {
          authEvent = true;
          syncIdentity(session?.user ?? null);
          if (event === "SIGNED_OUT" || event === "USER_UPDATED")
            setRecovery(false);
          if (event === "PASSWORD_RECOVERY") {
            setRecovery(true);
            router.replace("/reset-password");
          }
        },
      );
      unsubscribe = () => listener.subscription.unsubscribe();
      void client.auth
        .getSession()
        .then(({ data, error }) => {
          if (!alive || authEvent) return;
          if (error) throw error;
          syncIdentity(data.session?.user ?? null);
        })
        .catch((e) => {
          if (alive && !authEvent) {
            setAuthError(errorMessage(e));
            setReady(true);
          }
        });
    } catch (e) {
      setAuthError(errorMessage(e));
      setReady(true);
    }
    return () => {
      alive = false;
      ++epoch.current;
      identity.current = null;
      queue.current?.dispose();
      queue.current = null;
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh, router]);
  const setPerspective = (role: Role) => {
    setView(role);
    try {
      if (identity.current) localStorage.setItem(perspectiveKey(identity.current), role);
    } catch {}
  };
  const signOut = async () => {
    const { error } = await getSupabase().auth.signOut({ scope: "local" });
    if (error) throw error;
    ++epoch.current;
    identity.current = null;
    queue.current?.dispose();
    queue.current = null;
    setUser(null);
    setData(emptyCloud());
    setLoading(false);
    setLoaded(false);
    setView("client");
    setRecovery(false);
    setError("");
    setAuthError("");
    setMessage("");
    router.replace("/login");
  };
  return (
    <Context.Provider
      value={{
        user,
        ready,
        loading,
        loaded,
        error,
        authError,
        recovery,
        data,
        perspective,
        setPerspective,
        refresh,
        sync,
        notice,
        signOut,
      }}
    >
      {children}
      <div
        id="toast"
        className={`toast ${message ? "show" : ""}`}
        role="status"
      >
        {message}
      </div>
    </Context.Provider>
  );
}
export function useWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("WorkspaceProvider missing");
  return ctx;
}
