/**
 * Backend Sync Utility
 * Synchronises localStorage data with the shared Motoko backend canister.
 * This enables data sharing across multiple computers.
 */
import type { backendInterface } from "../backend";
import { createActorWithConfig } from "../config";

const APPOINTMENTS_KEY = "agenda_appointments_v2";
const CLIENTS_KEY = "agenda_client_records_v2";
const NEXT_ID_KEY = "agenda_next_id";
const USERS_KEY = "agenda_local_users";
const BYPASS_KEY = "agenda_bypass_login";

// ── Module-level actor reference for background sync ─────────────────────────
let _currentActor: backendInterface | null = null;
let _anonymousActor: backendInterface | null = null;

async function getAnonymousActor(): Promise<backendInterface> {
  if (!_anonymousActor) {
    _anonymousActor = await createActorWithConfig();
  }
  return _anonymousActor;
}

export function setCurrentActor(actor: backendInterface | null) {
  _currentActor = actor;
}

// ── Load data from backend canister into localStorage ─────────────────────────
export async function syncDataNow(actor: backendInterface): Promise<void> {
  await syncFromBackend(actor);
}

export async function syncFromBackend(actor: backendInterface): Promise<void> {
  try {
    let jsonStr: string;
    try {
      jsonStr = await actor.getSharedData();
    } catch (e1) {
      console.warn("syncFromBackend first attempt failed, retrying in 2s:", e1);
      await new Promise((r) => setTimeout(r, 2000));
      jsonStr = await actor.getSharedData();
    }
    if (!jsonStr || jsonStr === "{}" || jsonStr === "") return;
    const data = JSON.parse(jsonStr);

    // Only load from backend if data was explicitly saved (has lastSaved timestamp)
    // This prevents overwriting local data with the default empty backend state
    if (!data.lastSaved) {
      return;
    }

    if (data.appointments !== undefined) {
      localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(data.appointments));
    }
    if (data.clients !== undefined) {
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(data.clients));
    }
    if (data.nextId !== undefined) {
      localStorage.setItem(NEXT_ID_KEY, String(data.nextId));
    }
    if (data.paymentDates !== undefined) {
      localStorage.setItem(
        "weekly_payment_dates",
        JSON.stringify(data.paymentDates),
      );
    }
    if (data.clientExtraFields !== undefined) {
      localStorage.setItem(
        "agenda_client_extra_fields",
        JSON.stringify(data.clientExtraFields),
      );
    }
  } catch (_e) {
    console.warn("syncFromBackend failed:", _e);
  }
}

// ── Save localStorage data to backend canister ────────────────────────────────
// NOTE: This function intentionally does NOT catch errors.
// Callers (e.g. manual save button) should handle errors to show proper messages.
export async function syncToBackend(actor: backendInterface): Promise<void> {
  const appointmentsRaw = localStorage.getItem(APPOINTMENTS_KEY) || "[]";
  const clientsRaw = localStorage.getItem(CLIENTS_KEY) || "[]";
  const nextId = localStorage.getItem(NEXT_ID_KEY) || "1";

  const appointments = JSON.parse(appointmentsRaw);
  const clients = JSON.parse(clientsRaw);

  const paymentDatesRaw = localStorage.getItem("weekly_payment_dates") || "[]";
  const clientExtraFieldsRaw =
    localStorage.getItem("agenda_client_extra_fields") || "{}";
  const data = {
    appointments,
    clients,
    nextId,
    paymentDates: JSON.parse(paymentDatesRaw),
    clientExtraFields: JSON.parse(clientExtraFieldsRaw),
    lastSaved: new Date().toISOString(),
  };
  try {
    await actor.setSharedData(JSON.stringify(data));
  } catch (_e) {
    // Try with a fresh anonymous actor as fallback
    const anonActor = await getAnonymousActor();
    await anonActor.setSharedData(JSON.stringify(data));
  }
}

// ── Fire-and-forget sync (used after mutations) ───────────────────────────────
export function syncToBackendBackground(): void {
  if (_currentActor) {
    syncToBackend(_currentActor).catch(() => {
      // retry once after 3 seconds
      setTimeout(() => {
        if (_currentActor) {
          syncToBackend(_currentActor).catch(() => {});
        }
      }, 3000);
    });
  }
}

// ── Clear all data (appointments + clients) in backend and localStorage ───────
export async function clearAllData(): Promise<void> {
  // Clear localStorage
  localStorage.removeItem(APPOINTMENTS_KEY);
  localStorage.removeItem(CLIENTS_KEY);
  localStorage.removeItem(NEXT_ID_KEY);

  // Clear backend too
  if (_currentActor) {
    try {
      await _currentActor.setSharedData(
        JSON.stringify({
          appointments: [],
          clients: [],
          nextId: "1",
          lastSaved: new Date().toISOString(),
        }),
      );
    } catch (_e) {
      console.warn("clearAllData backend failed:", _e);
    }
  }
}

// ── Export all data as JSON (for download) ────────────────────────────────────
export function getExportJson(): string {
  const appointmentsRaw = localStorage.getItem(APPOINTMENTS_KEY) || "[]";
  const clientsRaw = localStorage.getItem(CLIENTS_KEY) || "[]";
  const nextId = localStorage.getItem(NEXT_ID_KEY) || "1";
  const usersRaw = localStorage.getItem(USERS_KEY) || "[]";
  const bypass = localStorage.getItem(BYPASS_KEY) || "false";

  let appointments: unknown[] = [];
  let clients: unknown[] = [];
  let users: unknown[] = [];
  try {
    appointments = JSON.parse(appointmentsRaw);
  } catch {
    appointments = [];
  }
  try {
    clients = JSON.parse(clientsRaw);
  } catch {
    clients = [];
  }
  try {
    users = JSON.parse(usersRaw);
  } catch {
    users = [];
  }

  return JSON.stringify(
    {
      appointments,
      clients,
      nextId,
      users,
      bypass,
      exportedAt: new Date().toISOString(),
      version: "195",
    },
    null,
    2,
  );
}

// ── Export appointments and clients as CSV ────────────────────────────────────
export function downloadExportCsv(): void {
  const date = new Date().toISOString().slice(0, 10);
  const BOM = "\uFEFF";

  // ── Appointments CSV ──
  let appointments: unknown[] = [];
  try {
    appointments = JSON.parse(localStorage.getItem(APPOINTMENTS_KEY) || "[]");
  } catch {
    appointments = [];
  }

  const apptHeaders = [
    "ID",
    "Date",
    "Heure Début",
    "Heure Fin",
    "Client",
    "Référence",
    "Téléphone",
    "Service",
    "Notes",
    "Montant Dû",
    "Montant Payé",
    "Fait",
    "Annulé",
    "Commentaire",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apptRows = (appointments as any[]).map((a) => {
    let dateStr = "";
    try {
      let ns: bigint;
      if (
        typeof a.dateHeure === "string" &&
        a.dateHeure.startsWith("__bigint__")
      ) {
        ns = BigInt(a.dateHeure.slice(10));
      } else {
        ns = BigInt(String(a.dateHeure));
      }
      const ms = Number(ns / BigInt(1_000_000));
      dateStr = new Date(ms).toLocaleDateString("fr-FR");
    } catch {
      dateStr = String(a.dateHeure ?? "");
    }

    const bigintToNum = (v: unknown): number => {
      if (typeof v === "string" && v.startsWith("__bigint__"))
        return Number(v.slice(10));
      return Number(v ?? 0);
    };

    const esc = (v: unknown) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n"))
        return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    return [
      esc(bigintToNum(a.id)),
      esc(dateStr),
      esc(a.heureDebut ?? ""),
      esc(a.heureFin ?? ""),
      esc(a.nomClient ?? ""),
      esc(a.referenceClient ?? ""),
      esc(a.numeroTelephone ?? ""),
      esc(a.service ?? ""),
      esc(a.notes ?? ""),
      esc(bigintToNum(a.montantDu)),
      esc(bigintToNum(a.montantPaye)),
      esc(a.fait ? "Oui" : "Non"),
      esc(a.annule ? "Oui" : "Non"),
      esc(a.commentaireManuel ?? ""),
    ].join(",");
  });

  const apptCsv = BOM + [apptHeaders.join(","), ...apptRows].join("\n");
  const apptBlob = new Blob([apptCsv], { type: "text/csv;charset=utf-8;" });
  const apptUrl = URL.createObjectURL(apptBlob);
  const apptLink = document.createElement("a");
  apptLink.href = apptUrl;
  apptLink.download = `rendez-vous-${date}.csv`;
  document.body.appendChild(apptLink);
  apptLink.click();
  document.body.removeChild(apptLink);
  URL.revokeObjectURL(apptUrl);

  // ── Clients CSV ──
  let clients: unknown[] = [];
  try {
    clients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || "[]");
  } catch {
    clients = [];
  }

  const clientHeaders = [
    "ID",
    "Nom",
    "Référence",
    "Téléphone",
    "Adresse",
    "Service",
    "Notes",
    "Courriel 1",
    "Courriel 2",
    "Date de naissance",
    "Nom Second Contact",
    "Tél Second Contact",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRows = (clients as any[]).map((c) => {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n"))
        return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const bigintToNum = (v: unknown): number => {
      if (typeof v === "string" && v.startsWith("__bigint__"))
        return Number(v.slice(10));
      return Number(v ?? 0);
    };
    return [
      esc(bigintToNum(c.id)),
      esc(c.clientName ?? ""),
      esc(c.referenceClient ?? ""),
      esc(c.phoneNumber ?? ""),
      esc(c.address ?? ""),
      esc(c.service ?? ""),
      esc(c.notes ?? ""),
      esc(c.courriel1 ?? ""),
      esc(c.courriel2 ?? ""),
      esc(c.dateNaissance ?? ""),
      esc(c.nomSecondContact ?? ""),
      esc(c.telSecondContact ?? ""),
    ].join(",");
  });

  const clientCsv = BOM + [clientHeaders.join(","), ...clientRows].join("\n");
  const clientBlob = new Blob([clientCsv], { type: "text/csv;charset=utf-8;" });
  const clientUrl = URL.createObjectURL(clientBlob);
  const clientLink = document.createElement("a");
  clientLink.href = clientUrl;
  clientLink.download = `clients-${date}.csv`;
  document.body.appendChild(clientLink);
  clientLink.click();
  document.body.removeChild(clientLink);
  URL.revokeObjectURL(clientUrl);
}

// ── Restore data from imported JSON ──────────────────────────────────────────
export function restoreFromJson(jsonStr: string): {
  ok: boolean;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonStr);
    if (data.appointments !== undefined) {
      localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(data.appointments));
    }
    if (data.clients !== undefined) {
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(data.clients));
    }
    if (data.nextId !== undefined) {
      localStorage.setItem(NEXT_ID_KEY, String(data.nextId));
    }
    if (data.users !== undefined) {
      localStorage.setItem(USERS_KEY, JSON.stringify(data.users));
    }
    if (data.bypass !== undefined) {
      localStorage.setItem(BYPASS_KEY, String(data.bypass));
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Fichier JSON invalide ou corrompu" };
  }
}

// ── Google Apps Script sync ───────────────────────────────────────────────────
const GOOGLE_SCRIPT_URL_KEY = "agenda_google_script_url";

export function getGoogleScriptUrl(): string {
  return localStorage.getItem(GOOGLE_SCRIPT_URL_KEY) || "";
}

export function setGoogleScriptUrl(url: string): void {
  localStorage.setItem(GOOGLE_SCRIPT_URL_KEY, url);
}

// POST data to Google Apps Script (no custom Content-Type to avoid CORS preflight)
export async function syncToGoogle(): Promise<void> {
  const url = getGoogleScriptUrl();
  if (!url) throw new Error("URL Google Apps Script non configurée");
  const secret = getGoogleSecret();
  const exportData = JSON.parse(getExportJson());
  const payload = { ...exportData, _secret: secret };
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
}

// GET data from Google Apps Script and restore to localStorage
export async function syncFromGoogle(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const url = getGoogleScriptUrl();
  if (!url) return { ok: false, error: "URL non configurée" };
  try {
    const secret = getGoogleSecret();
    const fetchUrl = secret ? `${url}?key=${encodeURIComponent(secret)}` : url;
    const response = await fetch(fetchUrl);
    if (!response.ok)
      return { ok: false, error: `Erreur HTTP ${response.status}` };
    const json = await response.text();
    if (!json || json === "{}" || json === "")
      return { ok: false, error: "Aucune donnée trouvée" };
    try {
      const parsed = JSON.parse(json);
      const { _secret: _removed, ...cleanData } = parsed;
      return restoreFromJson(JSON.stringify(cleanData));
    } catch {
      return restoreFromJson(json);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Google sync secret key
const GOOGLE_SECRET_KEY = "agenda_google_secret";

export function getGoogleSecret(): string {
  return localStorage.getItem(GOOGLE_SECRET_KEY) || "";
}

export function setGoogleSecret(secret: string): void {
  localStorage.setItem(GOOGLE_SECRET_KEY, secret);
}
