import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "advanced" | "reader";

export interface LocalUser {
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: number;
}

export interface LocalSession {
  username: string;
  role: UserRole;
  loginTime: number;
}

interface LocalAuthContextValue {
  session: LocalSession | null;
  bypass: boolean;
  isReady: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  setBypass: (enabled: boolean) => void;
  users: LocalUser[];
  addUserAsync: (
    username: string,
    password: string,
    role: UserRole,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateUserAsync: (
    username: string,
    password: string | null,
    role: UserRole,
  ) => Promise<{ ok: boolean; error?: string }>;
  removeUser: (username: string) => { ok: boolean; error?: string };
}

// ── Storage keys ──────────────────────────────────────────────────────────────
const USERS_KEY = "agenda_local_users";
const SESSION_KEY = "agenda_local_session";
const BYPASS_KEY = "agenda_local_bypass";

// ── Hash helper ───────────────────────────────────────────────────────────────
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_ADMIN_USERNAME = "Administrateur_root";
const DEFAULT_ADMIN_PASSWORD = "Administrateur_root";

// ── Storage helpers ───────────────────────────────────────────────────────────
function loadUsers(): LocalUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as LocalUser[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveUsers(users: LocalUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as LocalSession;
  } catch {
    /* ignore */
  }
  return null;
}

function saveSession(session: LocalSession | null): void {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function loadBypass(): boolean {
  return localStorage.getItem(BYPASS_KEY) === "true";
}

function saveBypass(val: boolean): void {
  localStorage.setItem(BYPASS_KEY, String(val));
}

// ── Context ───────────────────────────────────────────────────────────────────
const LocalAuthContext = createContext<LocalAuthContextValue | null>(null);

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [bypass, setBypassState] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      let storedUsers = loadUsers();
      if (storedUsers.length === 0) {
        const hash = await sha256(DEFAULT_ADMIN_PASSWORD);
        storedUsers = [
          {
            username: DEFAULT_ADMIN_USERNAME,
            passwordHash: hash,
            role: "admin",
            createdAt: Date.now(),
          },
        ];
        saveUsers(storedUsers);
      }
      setUsers(storedUsers);

      const storedBypass = loadBypass();
      setBypassState(storedBypass);

      if (storedBypass) {
        const existingSession = loadSession();
        if (existingSession) {
          setSession(existingSession);
        } else {
          const adminUser = storedUsers.find((u) => u.role === "admin");
          if (adminUser) {
            const sess: LocalSession = {
              username: adminUser.username,
              role: adminUser.role,
              loginTime: Date.now(),
            };
            setSession(sess);
            saveSession(sess);
          }
        }
      } else {
        const existingSession = loadSession();
        setSession(existingSession);
      }

      setIsReady(true);
    })();
  }, []);

  const login = useCallback(
    async (
      username: string,
      password: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      const currentUsers = loadUsers();
      const user = currentUsers.find((u) => u.username === username);
      if (!user)
        return { ok: false, error: "Identifiant ou mot de passe incorrect" };
      const hash = await sha256(password);
      if (hash !== user.passwordHash)
        return { ok: false, error: "Identifiant ou mot de passe incorrect" };
      const sess: LocalSession = {
        username: user.username,
        role: user.role,
        loginTime: Date.now(),
      };
      setSession(sess);
      saveSession(sess);
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(() => {
    setSession(null);
    saveSession(null);
  }, []);

  const setBypass = useCallback((enabled: boolean) => {
    saveBypass(enabled);
    setBypassState(enabled);
    if (enabled) {
      const currentUsers = loadUsers();
      const adminUser = currentUsers.find((u) => u.role === "admin");
      if (adminUser) {
        const sess: LocalSession = {
          username: adminUser.username,
          role: adminUser.role,
          loginTime: Date.now(),
        };
        setSession(sess);
        saveSession(sess);
      }
    }
  }, []);

  const addUserAsync = useCallback(
    async (
      username: string,
      password: string,
      role: UserRole,
    ): Promise<{ ok: boolean; error?: string }> => {
      const currentUsers = loadUsers();
      if (currentUsers.find((u) => u.username === username)) {
        return { ok: false, error: "Ce nom d'utilisateur existe déjà" };
      }
      const hash = await sha256(password);
      const newUser: LocalUser = {
        username,
        passwordHash: hash,
        role,
        createdAt: Date.now(),
      };
      const updated = [...currentUsers, newUser];
      saveUsers(updated);
      setUsers(updated);
      return { ok: true };
    },
    [],
  );

  const updateUserAsync = useCallback(
    async (
      username: string,
      password: string | null,
      role: UserRole,
    ): Promise<{ ok: boolean; error?: string }> => {
      const currentUsers = loadUsers();
      const idx = currentUsers.findIndex((u) => u.username === username);
      if (idx === -1) return { ok: false, error: "Utilisateur non trouvé" };
      if (role !== "admin" && currentUsers[idx].role === "admin") {
        const adminCount = currentUsers.filter(
          (u) => u.role === "admin",
        ).length;
        if (adminCount <= 1)
          return {
            ok: false,
            error: "Impossible de retirer le dernier administrateur",
          };
      }
      const hash = password ? await sha256(password) : null;
      const updated = [...currentUsers];
      updated[idx] = {
        ...updated[idx],
        role,
        passwordHash: hash ?? updated[idx].passwordHash,
      };
      saveUsers(updated);
      setUsers(updated);
      return { ok: true };
    },
    [],
  );

  const removeUser = useCallback(
    (username: string): { ok: boolean; error?: string } => {
      const currentUsers = loadUsers();
      const user = currentUsers.find((u) => u.username === username);
      if (!user) return { ok: false, error: "Utilisateur non trouvé" };
      if (user.role === "admin") {
        const adminCount = currentUsers.filter(
          (u) => u.role === "admin",
        ).length;
        if (adminCount <= 1)
          return {
            ok: false,
            error: "Impossible de supprimer le dernier administrateur",
          };
      }
      const updated = currentUsers.filter((u) => u.username !== username);
      saveUsers(updated);
      setUsers(updated);
      return { ok: true };
    },
    [],
  );

  const value: LocalAuthContextValue = {
    session,
    bypass,
    isReady,
    login,
    logout,
    setBypass,
    users,
    addUserAsync,
    updateUserAsync,
    removeUser,
  };

  return (
    <LocalAuthContext.Provider value={value}>
      {children}
    </LocalAuthContext.Provider>
  );
}

export function useLocalAuth() {
  const ctx = useContext(LocalAuthContext);
  if (!ctx)
    throw new Error("useLocalAuth must be used inside LocalAuthProvider");
  return ctx;
}
