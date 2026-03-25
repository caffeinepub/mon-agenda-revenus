/**
 * Local Data Store
 * All app data (appointments + clients) stored in localStorage
 * Eliminates dependency on ICP backend canister for data persistence
 */

import type {
  ClientRecord,
  DemandeEdition,
  DomaineListingMensuel,
  JoursSemaine,
  RendezVous,
  TotauxListingMensuel,
  TypeRepetition,
} from "../backend";

// ── Storage Keys ──────────────────────────────────────────────────────────────
const APPOINTMENTS_KEY = "agenda_appointments_v2";
const CLIENTS_KEY = "agenda_client_records_v2";
const NEXT_ID_KEY = "agenda_next_id";

// ── BigInt Serialization ─────────────────────────────────────────────────────
// IMPORTANT: BigInt.prototype.toJSON must NOT be set globally (see main.tsx)
// because it fires BEFORE our replacer, causing BigInts to be stored as plain
// strings and breaking comparisons like `apt.dateHeure >= BigInt(...)`.

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return `__bigint__${value.toString()}`;
  if (value instanceof Uint8Array)
    return `__uint8__${btoa(String.fromCharCode(...Array.from(value)))}`;
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("__bigint__")) return BigInt(value.slice(10));
    if (value.startsWith("__uint8__")) {
      const b64 = value.slice(9);
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
  }
  return value;
}

// ── BigInt field normalization (migration for data stored without __bigint__ prefix) ──
// If BigInt.prototype.toJSON was previously set, BigInt values may have been
// stored as plain numeric strings. Normalize them back to BigInt here.
function toBigIntSafe(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.round(value));
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) return BigInt(trimmed);
  }
  return BigInt(0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAppointment(apt: any): RendezVous {
  return {
    ...apt,
    id: toBigIntSafe(apt.id),
    dateHeure: toBigIntSafe(apt.dateHeure),
    montantDu: toBigIntSafe(apt.montantDu),
    montantPaye: toBigIntSafe(apt.montantPaye),
    owner: FAKE_PRINCIPAL,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeClient(c: any): ClientRecord {
  return {
    ...c,
    id: toBigIntSafe(c.id),
    owner: FAKE_PRINCIPAL,
  };
}

// Fake Principal to satisfy TypeScript types (owner field not used in UI)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FAKE_PRINCIPAL = {
  toText: () => "aaaaa-aa",
  isAnonymous: () => false,
} as any;

// ── ID Generation ────────────────────────────────────────────────────────────
function getNextId(): bigint {
  const raw = localStorage.getItem(NEXT_ID_KEY);
  const current = raw ? BigInt(raw) : BigInt(1);
  localStorage.setItem(NEXT_ID_KEY, (current + BigInt(1)).toString());
  return current;
}

// ── Appointment Storage ───────────────────────────────────────────────────────
export function loadAppointments(): RendezVous[] {
  try {
    const raw = localStorage.getItem(APPOINTMENTS_KEY);
    if (!raw) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(raw, reviver) as any[];
    return parsed.map(normalizeAppointment);
  } catch {
    return [];
  }
}

export function saveAppointments(appointments: RendezVous[]): void {
  // Don't store the fake Principal object
  const toStore = appointments.map(({ owner: _owner, ...rest }) => rest);
  localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(toStore, replacer));
}

// ── Client Record Storage ─────────────────────────────────────────────────────
export function loadClients(): ClientRecord[] {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    if (!raw) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(raw, reviver) as any[];
    return parsed.map(normalizeClient);
  } catch {
    return [];
  }
}

export function saveClients(clients: ClientRecord[]): void {
  const toStore = clients.map(({ owner: _owner, ...rest }) => rest);
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(toStore, replacer));
}

// ── Repetition Helpers ────────────────────────────────────────────────────────
function getDaysForRepetition(jours: JoursSemaine): number[] {
  // Returns 0=Sun, 1=Mon, ... 6=Sat
  const days: number[] = [];
  if (jours.dimanche) days.push(0);
  if (jours.lundi) days.push(1);
  if (jours.mardi) days.push(2);
  if (jours.mercredi) days.push(3);
  if (jours.jeudi) days.push(4);
  if (jours.vendredi) days.push(5);
  if (jours.samedi) days.push(6);
  return days;
}

function generateRecurringAppointments(
  base: Omit<RendezVous, "id" | "owner">,
  repetition: TypeRepetition,
): Omit<RendezVous, "id" | "owner">[] {
  const results: Omit<RendezVous, "id" | "owner">[] = [base];

  if (repetition.__kind__ === "aucune") {
    return results;
  }

  const startDateMs = Number(base.dateHeure / BigInt(1_000_000));
  const startDate = new Date(startDateMs);
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 2); // 2 years of recurrence

  if (repetition.__kind__ === "hebdomadaire") {
    const targetDays = getDaysForRepetition(repetition.hebdomadaire);
    const cur = new Date(startDate);
    cur.setDate(cur.getDate() + 7); // Start from next week
    while (cur <= endDate) {
      if (targetDays.includes(cur.getDay())) {
        const dateMs = cur.getTime();
        const dateHeure = BigInt(dateMs) * BigInt(1_000_000);
        results.push({ ...base, dateHeure });
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else if (repetition.__kind__ === "mensuelle") {
    const cur = new Date(startDate);
    cur.setMonth(cur.getMonth() + 1);
    while (cur <= endDate) {
      const dateHeure = BigInt(cur.getTime()) * BigInt(1_000_000);
      results.push({ ...base, dateHeure });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (repetition.__kind__ === "annuelle") {
    const cur = new Date(startDate);
    cur.setFullYear(cur.getFullYear() + 1);
    while (cur <= endDate) {
      const dateHeure = BigInt(cur.getTime()) * BigInt(1_000_000);
      results.push({ ...base, dateHeure });
      cur.setFullYear(cur.getFullYear() + 1);
    }
  }

  return results;
}

// ── Appointment CRUD ──────────────────────────────────────────────────────────
export function addAppointment(data: {
  dateHeure: bigint;
  heureDebut: string;
  heureFin: string;
  nomClient: string;
  referenceClient: string;
  numeroTelephone: string;
  adresse: string;
  service: string;
  notes: string;
  montantDu: bigint;
  repetition: TypeRepetition;
}): RendezVous[] {
  const appointments = loadAppointments();

  const baseApt: Omit<RendezVous, "id" | "owner"> = {
    dateHeure: data.dateHeure,
    heureDebut: data.heureDebut,
    heureFin: data.heureFin,
    nomClient: data.nomClient,
    referenceClient: data.referenceClient,
    numeroTelephone: data.numeroTelephone,
    adresse: data.adresse,
    service: data.service,
    notes: data.notes,
    montantDu: data.montantDu,
    repetition: data.repetition,
    fait: false,
    annule: false,
    paiementAnticipe: false,
    montantPaye: BigInt(0),
    commentaireManuel: "",
  };

  const generated = generateRecurringAppointments(baseApt, data.repetition);
  const newAppointments: RendezVous[] = generated.map((apt) => ({
    ...apt,
    id: getNextId(),
    owner: FAKE_PRINCIPAL,
  }));

  const updated = [...appointments, ...newAppointments];
  saveAppointments(updated);
  return updated;
}

export function updateAppointment(data: {
  id: bigint;
  dateHeure: bigint;
  heureDebut: string;
  heureFin: string;
  nomClient: string;
  referenceClient: string;
  numeroTelephone: string;
  adresse: string;
  service: string;
  notes: string;
  montantDu: bigint;
  repetition: TypeRepetition;
  demandeEdition: DemandeEdition;
}): void {
  const appointments = loadAppointments();
  const target = appointments.find((a) => a.id === data.id);
  if (!target) return;

  const updated = appointments.map((apt) => {
    const isTarget = apt.id === data.id;
    const targetDay = new Date(Number(data.dateHeure) / 1_000_000).getDay();
    const aptDay = new Date(Number(apt.dateHeure) / 1_000_000).getDay();
    const isFutureOfSameClient =
      data.demandeEdition === "futursDuClient" &&
      apt.referenceClient === data.referenceClient &&
      apt.dateHeure >= data.dateHeure &&
      aptDay === targetDay;

    if (isTarget || isFutureOfSameClient) {
      return {
        ...apt,
        heureDebut: data.heureDebut,
        heureFin: data.heureFin,
        nomClient: data.nomClient,
        referenceClient: data.referenceClient,
        numeroTelephone: data.numeroTelephone,
        adresse: data.adresse,
        service: data.service,
        notes: data.notes,
        montantDu: data.montantDu,
        repetition: data.repetition,
        // Preserve dateHeure only if it's the specific target being edited
        dateHeure: isTarget ? data.dateHeure : apt.dateHeure,
      };
    }
    return apt;
  });

  saveAppointments(updated);
}

export function deleteAppointment(
  id: bigint,
  mode: DemandeEdition,
  referenceClient?: string,
  dateHeure?: bigint,
): void {
  const appointments = loadAppointments();
  const target = appointments.find((a) => a.id === id);
  if (!target) return;

  const refClient = referenceClient ?? target.referenceClient;
  const targetDate = dateHeure ?? target.dateHeure;

  const updated = appointments.filter((apt) => {
    if (apt.id === id) return false; // Always delete the target
    if (
      mode === "futursDuClient" &&
      apt.referenceClient === refClient &&
      apt.dateHeure >= targetDate &&
      new Date(Number(apt.dateHeure) / 1_000_000).getDay() ===
        new Date(Number(targetDate) / 1_000_000).getDay()
    )
      return false;
    return true;
  });

  saveAppointments(updated);
}

export function updateAppointmentStatus(
  id: bigint,
  fait: boolean | null,
  annule: boolean | null,
  commentaireManuel: string | null,
): void {
  const appointments = loadAppointments();
  const updated = appointments.map((apt) => {
    if (apt.id !== id) return apt;
    return {
      ...apt,
      ...(fait !== null ? { fait } : {}),
      ...(annule !== null ? { annule } : {}),
      ...(commentaireManuel !== null ? { commentaireManuel } : {}),
    };
  });
  saveAppointments(updated);
}

export function updateMontantPaye(id: bigint, montantPaye: bigint): void {
  const appointments = loadAppointments();
  const updated = appointments.map((apt) => {
    if (apt.id !== id) return apt;
    return { ...apt, montantPaye };
  });
  saveAppointments(updated);
}

// ── Client Record CRUD ────────────────────────────────────────────────────────
export function addClientRecord(data: {
  clientName: string;
  referenceClient: string;
  phoneNumber: string;
  address: string;
  service: string;
  notes: string;
  photo: Uint8Array | null;
}): ClientRecord {
  const clients = loadClients();
  const newClient: ClientRecord = {
    id: getNextId(),
    clientName: data.clientName,
    referenceClient: data.referenceClient,
    phoneNumber: data.phoneNumber,
    address: data.address,
    service: data.service,
    notes: data.notes,
    photo: data.photo ?? undefined,
    owner: FAKE_PRINCIPAL,
  };
  saveClients([...clients, newClient]);
  return newClient;
}

export function updateClientRecord(data: {
  id: bigint;
  clientName: string;
  referenceClient: string;
  phoneNumber: string;
  address: string;
  service: string;
  notes: string;
  photo: Uint8Array | null;
}): void {
  const clients = loadClients();
  const updated = clients.map((c) => {
    if (c.id !== data.id) return c;
    return {
      ...c,
      clientName: data.clientName,
      referenceClient: data.referenceClient,
      phoneNumber: data.phoneNumber,
      address: data.address,
      service: data.service,
      notes: data.notes,
      photo: data.photo ?? c.photo,
    };
  });
  saveClients(updated);
}

export function deleteClientRecord(id: bigint): void {
  const clients = loadClients();
  saveClients(clients.filter((c) => c.id !== id));
}

// ── Derived Computations ──────────────────────────────────────────────────────

/**
 * Get unique (referenceClient, nomClient) pairs for a given year+month
 * Used to populate the Monthly Listing table
 */
export function getMonthlyClientList(
  appointments: RendezVous[],
  year: number,
  month: number,
): DomaineListingMensuel[] {
  const monthStart =
    BigInt(new Date(year, month - 1, 1).getTime()) * BigInt(1_000_000);
  const monthEnd =
    BigInt(new Date(year, month, 0, 23, 59, 59, 999).getTime()) *
    BigInt(1_000_000);

  const clientMap = new Map<string, string>();
  for (const apt of appointments) {
    if (apt.dateHeure >= monthStart && apt.dateHeure <= monthEnd) {
      if (!clientMap.has(apt.referenceClient)) {
        clientMap.set(apt.referenceClient, apt.nomClient);
      }
    }
  }

  // Return stub DomaineListingMensuel objects - actual values calculated client-side
  return Array.from(clientMap.entries()).map(
    ([referenceClient, nomClient]) => ({
      referenceClient,
      nomClient,
      creditMois: BigInt(0),
      totalDuesIndividuelles: BigInt(0),
      totalFaitEtPaye: BigInt(0),
      rendezVousFaitsTotal: BigInt(0),
      totalDuMois: BigInt(0),
      nbRendezVousFaits: BigInt(0),
      soldeCumule: BigInt(0),
      totalSommesDues: BigInt(0),
      finExerciceCredit: BigInt(0),
      creditFinMois: BigInt(0),
      soldeRestant: BigInt(0),
      totalPayeMois: BigInt(0),
      creditCumule: BigInt(0),
      totalReelRecu: BigInt(0),
    }),
  );
}

/**
 * Compute monthly listing totals from appointments
 */
export function computeMonthlyTotals(
  appointments: RendezVous[],
  year: number,
  month: number,
): TotauxListingMensuel {
  const monthStart =
    BigInt(new Date(year, month - 1, 1).getTime()) * BigInt(1_000_000);
  const monthEnd =
    BigInt(new Date(year, month, 0, 23, 59, 59, 999).getTime()) *
    BigInt(1_000_000);

  let totalNbRdvFaits = 0;
  let totalSommesDues = BigInt(0);
  let totalFaitEtPaye = BigInt(0);
  let totalPayeMois = BigInt(0);

  for (const apt of appointments) {
    if (apt.dateHeure >= monthStart && apt.dateHeure <= monthEnd) {
      if (apt.fait && !apt.annule) {
        totalNbRdvFaits++;
        totalSommesDues += apt.montantDu;
        totalFaitEtPaye += apt.montantPaye;
      }
      totalPayeMois += apt.montantPaye;
    }
  }

  return {
    totalNbRendezVousFaits: BigInt(totalNbRdvFaits),
    totalSommesDues,
    totalDuMois: totalSommesDues,
    totalDuesIndividuelles: totalSommesDues,
    totalPayeMois,
    totalFaitEtPaye,
    totalRendezVousFaits: BigInt(totalNbRdvFaits),
    totalSoldeRestantPositif: BigInt(0),
    totalSoldeRestantNegatif: BigInt(0),
    totalTotalReelRecu: totalFaitEtPaye,
  };
}

/**
 * Compute financial statistics
 */
export function computeFinancialStats(appointments: RendezVous[]) {
  let totalDu = BigInt(0);
  let totalPaye = BigInt(0);
  let totalFaitEtPaye = BigInt(0);
  let totalFaitNonAnnule = BigInt(0);

  for (const apt of appointments) {
    totalDu += apt.montantDu;
    totalPaye += apt.montantPaye;
    if (apt.fait && !apt.annule) {
      totalFaitEtPaye += apt.montantPaye;
      totalFaitNonAnnule += apt.montantDu;
    }
  }

  return {
    totalDu,
    totalPaye,
    totalFaitEtPaye,
    totalDuesIndividuelles: totalDu,
    totalFaitNonAnnule,
    totalEnAttente: totalDu - totalFaitNonAnnule,
    totalReelRecu: totalFaitEtPaye,
  };
}

/**
 * Compute client credit (Payé - Dû pour les RDV faits)
 */
export function computeClientCredit(
  appointments: RendezVous[],
  referenceClient: string,
): bigint {
  let totalPaye = BigInt(0);
  let totalDuFait = BigInt(0);

  for (const apt of appointments) {
    if (apt.referenceClient === referenceClient) {
      totalPaye += apt.montantPaye;
      if (apt.fait && !apt.annule) {
        totalDuFait += apt.montantDu;
      }
    }
  }

  return totalPaye - totalDuFait;
}

/**
 * Compute total réel reçu for a given year/month
 */
export function computeTotalReelRecu(
  appointments: RendezVous[],
  year: number,
  month: number,
): bigint {
  const monthStart =
    BigInt(new Date(year, month - 1, 1).getTime()) * BigInt(1_000_000);
  const monthEnd =
    BigInt(new Date(year, month, 0, 23, 59, 59, 999).getTime()) *
    BigInt(1_000_000);

  return appointments
    .filter(
      (apt) =>
        apt.dateHeure >= monthStart &&
        apt.dateHeure <= monthEnd &&
        apt.fait &&
        !apt.annule,
    )
    .reduce((sum, apt) => sum + apt.montantPaye, BigInt(0));
}

/**
 * Compute rapport PDF data (summary per client for a period)
 */
export function computeRapportPDF(
  appointments: RendezVous[],
  startMs: number,
  endMs: number,
) {
  const startNs = BigInt(startMs) * BigInt(1_000_000);
  const endNs = BigInt(endMs) * BigInt(1_000_000);

  const clientMap = new Map<
    string,
    {
      nomClient: string;
      nbRendezVousFaits: bigint;
      totalSommesDues: bigint;
      totalSommesRecues: bigint;
    }
  >();

  for (const apt of appointments) {
    if (apt.dateHeure >= startNs && apt.dateHeure <= endNs) {
      const existing = clientMap.get(apt.referenceClient) ?? {
        nomClient: apt.nomClient,
        nbRendezVousFaits: BigInt(0),
        totalSommesDues: BigInt(0),
        totalSommesRecues: BigInt(0),
      };

      if (apt.fait && !apt.annule) {
        existing.nbRendezVousFaits += BigInt(1);
        existing.totalSommesDues += apt.montantDu;
        existing.totalSommesRecues += apt.montantPaye;
      }

      clientMap.set(apt.referenceClient, existing);
    }
  }

  return Array.from(clientMap.entries()).map(([referenceClient, data]) => ({
    referenceClient,
    nomClient: data.nomClient,
    nbRendezVousFaits: data.nbRendezVousFaits,
    totalSommesDues: data.totalSommesDues,
    totalSommesRecues: data.totalSommesRecues,
    totalCredits: data.totalSommesRecues - data.totalSommesDues,
  }));
}
