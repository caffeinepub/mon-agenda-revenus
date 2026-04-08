import { create } from "zustand";
import type { AppSettings, Appointment, Client, User } from "../types";

const LS_APPOINTMENTS = "revenueplanner_appointments";
const LS_CLIENTS = "revenueplanner_clients";
const LS_USERS = "revenueplanner_users";
const LS_SETTINGS = "revenueplanner_settings";
const LS_PAYMENT_DATES = "revenueplanner_payment_dates";
const LS_CURRENT_USER = "revenueplanner_current_user";

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Ensure a client object always has all optional fields as empty strings (not undefined).
 *  This handles data migrated from older app versions that lacked some fields. */
function normalizeClient(c: Client): Client {
  return {
    id: c.id ?? "",
    reference: c.reference ?? "",
    nom: c.nom ?? "",
    prenom: c.prenom ?? "",
    email1: c.email1 ?? "",
    email2: c.email2 ?? "",
    dateNaissance: c.dateNaissance ?? "",
    nom2Contact: c.nom2Contact ?? "",
    tel2Contact: c.tel2Contact ?? "",
    telephone: c.telephone ?? "",
    adresse: c.adresse ?? "",
    service: c.service ?? "",
    note: c.note ?? "",
    photo: c.photo ?? "",
    tarifHoraire: typeof c.tarifHoraire === "number" ? c.tarifHoraire : 0,
    createdAt: c.createdAt ?? new Date().toISOString(),
  };
}

function saveLS<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

const defaultSettings: AppSettings = {
  darkMode: false,
  fontColor: "rgb(226,107,10)",
  googleDriveUrl: "",
  googleDrivePassword: "",
  dailyStartHour: "07:00",
  dailyEndHour: "22:00",
};

const defaultUsers: User[] = [
  {
    id: "admin-root",
    login: "Administrateur_root",
    password: "Administrateur_root",
    role: "admin",
    sansMotDePasse: false,
  },
];

interface StoreState {
  appointments: Appointment[];
  clients: Client[];
  users: User[];
  settings: AppSettings;
  paymentDates: Record<string, string>;
  currentUser: User | null;
  isLoggedIn: boolean;

  // Auth
  login: (loginStr: string, password: string) => boolean;
  loginWithoutPassword: () => boolean;
  logout: () => void;

  // Appointments
  addAppointment: (a: Appointment) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  deleteFutureAppointments: (
    clientRef: string,
    fromDate: string,
    dayOfWeek: number,
  ) => void;
  updateFutureAppointments: (
    clientRef: string,
    fromDate: string,
    dayOfWeek: number,
    updates: Partial<Appointment>,
  ) => void;

  // Clients
  addClient: (c: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Users
  addUser: (u: User) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;

  // Settings
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Payment dates
  setPaymentDate: (appointmentId: string, date: string) => void;

  // Import/Export
  exportData: () => string;
  importData: (jsonStr: string) => boolean;
  resetData: () => void;

  // Next client reference
  nextClientRef: () => string;
}

export const useStore = create<StoreState>((set, get) => ({
  appointments: loadLS<Appointment[]>(LS_APPOINTMENTS, []),
  clients: loadLS<Client[]>(LS_CLIENTS, []).map(normalizeClient),
  users: loadLS<User[]>(LS_USERS, defaultUsers),
  settings: {
    ...defaultSettings,
    ...loadLS<Partial<AppSettings>>(LS_SETTINGS, {}),
  },
  paymentDates: loadLS<Record<string, string>>(LS_PAYMENT_DATES, {}),
  currentUser: loadLS<User | null>(LS_CURRENT_USER, null),
  isLoggedIn: loadLS<User | null>(LS_CURRENT_USER, null) !== null,

  login: (loginStr, password) => {
    const { users } = get();
    const user = users.find(
      (u) => u.login === loginStr && u.password === password,
    );
    if (user) {
      set({ currentUser: user, isLoggedIn: true });
      saveLS(LS_CURRENT_USER, user);
      return true;
    }
    return false;
  },

  loginWithoutPassword: () => {
    const { users } = get();
    // Allow only if any user has sansMotDePasse = true
    const user = users.find((u) => u.sansMotDePasse && u.role === "admin");
    if (user) {
      set({ currentUser: user, isLoggedIn: true });
      saveLS(LS_CURRENT_USER, user);
      return true;
    }
    return false;
  },

  logout: () => {
    set({ currentUser: null, isLoggedIn: false });
    localStorage.removeItem(LS_CURRENT_USER);
  },

  addAppointment: (a) => {
    set((s) => {
      const appointments = [...s.appointments, a];
      saveLS(LS_APPOINTMENTS, appointments);
      return { appointments };
    });
  },

  updateAppointment: (id, updates) => {
    set((s) => {
      const appointments = s.appointments.map((a) =>
        a.id === id ? { ...a, ...updates } : a,
      );
      saveLS(LS_APPOINTMENTS, appointments);
      return { appointments };
    });
  },

  deleteAppointment: (id) => {
    set((s) => {
      const appointments = s.appointments.filter((a) => a.id !== id);
      saveLS(LS_APPOINTMENTS, appointments);
      return { appointments };
    });
  },

  deleteFutureAppointments: (clientRef, fromDate, dayOfWeek) => {
    set((s) => {
      const appointments = s.appointments.filter((a) => {
        if (a.clientRef !== clientRef) return true;
        if (a.date < fromDate) return true;
        const d = new Date(a.date);
        // JS: 0=Sun,1=Mon...6=Sat → our dayOfWeek: 0=Mon...6=Sun
        const jsDay = d.getDay();
        const ourDay = jsDay === 0 ? 6 : jsDay - 1;
        return ourDay !== dayOfWeek;
      });
      saveLS(LS_APPOINTMENTS, appointments);
      return { appointments };
    });
  },

  updateFutureAppointments: (clientRef, fromDate, dayOfWeek, updates) => {
    set((s) => {
      const appointments = s.appointments.map((a) => {
        if (a.clientRef !== clientRef) return a;
        if (a.date < fromDate) return a;
        const d = new Date(a.date);
        const jsDay = d.getDay();
        const ourDay = jsDay === 0 ? 6 : jsDay - 1;
        if (ourDay !== dayOfWeek) return a;
        return { ...a, ...updates };
      });
      saveLS(LS_APPOINTMENTS, appointments);
      return { appointments };
    });
  },

  addClient: (c) => {
    set((s) => {
      const clients = [...s.clients, normalizeClient(c)];
      saveLS(LS_CLIENTS, clients);
      return { clients };
    });
  },

  updateClient: (id, updates) => {
    set((s) => {
      const clients = s.clients.map((c) =>
        c.id === id ? normalizeClient({ ...c, ...updates }) : c,
      );
      saveLS(LS_CLIENTS, clients);
      return { clients };
    });
  },

  deleteClient: (id) => {
    set((s) => {
      const clients = s.clients.filter((c) => c.id !== id);
      saveLS(LS_CLIENTS, clients);
      return { clients };
    });
  },

  addUser: (u) => {
    set((s) => {
      const users = [...s.users, u];
      saveLS(LS_USERS, users);
      return { users };
    });
  },

  updateUser: (id, updates) => {
    set((s) => {
      const users = s.users.map((u) =>
        u.id === id ? { ...u, ...updates } : u,
      );
      saveLS(LS_USERS, users);
      if (s.currentUser?.id === id) {
        const updated = { ...s.currentUser, ...updates };
        saveLS(LS_CURRENT_USER, updated);
        return { users, currentUser: updated };
      }
      return { users };
    });
  },

  deleteUser: (id) => {
    set((s) => {
      const users = s.users.filter((u) => u.id !== id);
      saveLS(LS_USERS, users);
      return { users };
    });
  },

  updateSettings: (updates) => {
    set((s) => {
      const settings = { ...s.settings, ...updates };
      saveLS(LS_SETTINGS, settings);
      // Apply dark mode to document
      if (updates.darkMode !== undefined) {
        document.documentElement.classList.toggle("dark", updates.darkMode);
      }
      return { settings };
    });
  },

  setPaymentDate: (appointmentId, date) => {
    set((s) => {
      const paymentDates = { ...s.paymentDates, [appointmentId]: date };
      saveLS(LS_PAYMENT_DATES, paymentDates);
      // Also update appointment paymentDate
      const appointments = s.appointments.map((a) =>
        a.id === appointmentId ? { ...a, paymentDate: date } : a,
      );
      saveLS(LS_APPOINTMENTS, appointments);
      return { paymentDates, appointments };
    });
  },

  exportData: () => {
    const s = get();
    return JSON.stringify({
      version: 1,
      appointments: s.appointments,
      clients: s.clients,
      paymentDates: s.paymentDates,
      settings: {
        dailyStartHour: s.settings.dailyStartHour,
        dailyEndHour: s.settings.dailyEndHour,
      },
    });
  },

  importData: (jsonStr) => {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.appointments || !data.clients) return false;
      const appointments: Appointment[] = data.appointments;
      // Normalize all clients to ensure all 6 extra fields are present
      const clients: Client[] = (data.clients as Client[]).map(normalizeClient);
      const paymentDates: Record<string, string> = data.paymentDates ?? {};
      const settingsUpdate: Partial<AppSettings> = {};
      if (data.settings?.dailyStartHour)
        settingsUpdate.dailyStartHour = data.settings.dailyStartHour;
      if (data.settings?.dailyEndHour)
        settingsUpdate.dailyEndHour = data.settings.dailyEndHour;
      saveLS(LS_APPOINTMENTS, appointments);
      saveLS(LS_CLIENTS, clients);
      saveLS(LS_PAYMENT_DATES, paymentDates);
      set((s) => ({
        appointments,
        clients,
        paymentDates,
        settings: { ...s.settings, ...settingsUpdate },
      }));
      return true;
    } catch {
      return false;
    }
  },

  resetData: () => {
    saveLS(LS_APPOINTMENTS, []);
    saveLS(LS_CLIENTS, []);
    saveLS(LS_PAYMENT_DATES, {});
    set({ appointments: [], clients: [], paymentDates: {} });
  },

  nextClientRef: () => {
    const { clients } = get();
    const year = new Date().getFullYear();
    const prefix = `CLI-${year}-`;
    const nums = clients.map((c) => {
      const m = c.reference.match(/^CLI-\d{4}-(\d+)$/);
      return m ? Number.parseInt(m[1], 10) : 0;
    });
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
  },
}));

// Initialize dark mode on app start
const initSettings = loadLS<Partial<AppSettings>>(LS_SETTINGS, {});
if (initSettings.darkMode) {
  document.documentElement.classList.add("dark");
}
