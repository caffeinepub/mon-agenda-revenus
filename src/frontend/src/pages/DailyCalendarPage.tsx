import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientRecord, RendezVous } from "../backend";
import { DemandeEdition, type TypeRepetition } from "../backend";
import { useLocalAuth } from "../context/LocalAuthContext";
import {
  useDeleteAppointment,
  useGetAllAppointments,
  useGetAllClientRecords,
  useUpdateAppointment,
  useUpdateAppointmentStatus,
  useUpdateMontantPaye,
} from "../hooks/useQueries";

const ROW_H = 12;
const VERDANA: React.CSSProperties = {
  fontFamily: "Verdana, sans-serif",
  fontSize: 12,
};

const DAY_NAMES_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
const MONTH_NAMES_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// Generate all 15-min slots from 7h00 to 22h00
const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 22; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 22 && m > 0) break;
    TIME_SLOTS.push(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    );
  }
}

const COLS = [
  { label: "Heure", w: 47 },
  { label: "Nom", w: 100 },
  { label: "Réf", w: 51 },
  { label: "F", w: 24 },
  { label: "A", w: 24 },
  { label: "Dû", w: 47 },
  { label: "Payé", w: 47 },
  { label: "Date", w: 40 },
  { label: "Note", w: 74 },
];

function colStyle(w: number, last = false): React.CSSProperties {
  return {
    width: w,
    minWidth: w,
    maxWidth: w,
    height: ROW_H,
    lineHeight: `${ROW_H}px`,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    borderRight: last ? "none" : "1px solid #d1d5db",
    padding: "0 2px",
    boxSizing: "border-box",
    fontSize: 12,
  };
}

// ── ClientFicheModal ──────────────────────────────────────────────────────────
interface ClientFicheModalProps {
  referenceClient: string;
  clientName: string;
  clients: ClientRecord[];
  appointments: RendezVous[];
  onClose: () => void;
}

function ClientFicheModal({
  referenceClient,
  clientName,
  clients,
  appointments: allApts,
  onClose,
}: ClientFicheModalProps) {
  const client = clients.find((c) => c.referenceClient === referenceClient);
  const currentYear = new Date().getFullYear();
  const now = BigInt(Date.now()) * BigInt(1_000_000);
  const startOfYear =
    BigInt(new Date(currentYear, 0, 1).getTime()) * BigInt(1_000_000);
  const endOfYear =
    BigInt(new Date(currentYear + 1, 0, 1).getTime()) * BigInt(1_000_000);

  const clientApts = allApts
    .filter(
      (apt) =>
        apt.referenceClient === referenceClient &&
        apt.dateHeure >= startOfYear &&
        apt.dateHeure < endOfYear &&
        apt.dateHeure <= now,
    )
    .sort((a, b) => Number(a.dateHeure) - Number(b.dateHeure));

  const totalPaye = clientApts.reduce((s, a) => s + Number(a.montantPaye), 0);
  const totalDu = clientApts
    .filter((a) => a.fait)
    .reduce((s, a) => s + Number(a.montantDu), 0);
  const totalCredit = totalPaye - totalDu;

  const paymentDatesRaw = (() => {
    try {
      const raw = localStorage.getItem("weekly_payment_dates");
      return raw
        ? new Map<string, string>(JSON.parse(raw))
        : new Map<string, string>();
    } catch {
      return new Map<string, string>();
    }
  })();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 20000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 6,
          padding: 16,
          width: 420,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          fontFamily: "Verdana, sans-serif",
          fontSize: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 8,
          }}
        >
          <span style={{ fontWeight: "bold", fontSize: 13 }}>
            Fiche client — {clientName}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
        {client && (
          <div style={{ marginBottom: 12 }}>
            {client.phoneNumber && (
              <p style={{ margin: "2px 0" }}>
                <strong>Tél :</strong> {client.phoneNumber}
              </p>
            )}
            {client.address && (
              <p style={{ margin: "2px 0" }}>
                <strong>Adresse :</strong> {client.address}
              </p>
            )}
            {client.service && (
              <p style={{ margin: "2px 0" }}>
                <strong>Service :</strong> {client.service}
              </p>
            )}
          </div>
        )}
        <div
          style={{
            background: "#f8f8f8",
            border: "1px solid #ddd",
            borderRadius: 4,
            padding: 10,
            marginBottom: 12,
          }}
        >
          <p style={{ fontWeight: "bold", marginBottom: 6 }}>
            Résumé {currentYear}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2px 8px",
            }}
          >
            <span>Nb RDV faits</span>
            <span style={{ textAlign: "right", fontWeight: "bold" }}>
              {clientApts.filter((a) => a.fait).length}
            </span>
            <span>Total payé</span>
            <span
              style={{
                textAlign: "right",
                fontWeight: "bold",
                color: "#27ae60",
              }}
            >
              {totalPaye.toLocaleString("fr-FR")}
            </span>
            <span>Total dû</span>
            <span
              style={{
                textAlign: "right",
                fontWeight: "bold",
                color: "#2756ae",
              }}
            >
              {totalDu.toLocaleString("fr-FR")}
            </span>
            <span>Crédit</span>
            <span
              style={{
                textAlign: "right",
                fontWeight: "bold",
                color: totalCredit >= 0 ? "#27ae60" : "#c0392b",
              }}
            >
              {totalCredit.toLocaleString("fr-FR")}
            </span>
          </div>
        </div>
        <p style={{ fontWeight: "bold", marginBottom: 6 }}>
          Rendez-vous {currentYear}
        </p>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}
        >
          <thead>
            <tr style={{ background: "#e8e8e8" }}>
              {["Date", "Heure", "Dû", "Payé", "Date Pmt", "Fait"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "2px 4px",
                    textAlign: h === "Dû" || h === "Payé" ? "right" : "left",
                    fontSize: 10,
                    fontWeight: "bold",
                    border: "1px solid #ccc",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clientApts.map((apt, idx) => {
              const d = new Date(Number(apt.dateHeure) / 1_000_000);
              const dateStr = d.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
              });
              const payDate = paymentDatesRaw.get(apt.id.toString()) ?? "";
              const bg = idx % 2 === 0 ? "#fff" : "#f2f2f2";
              return (
                <tr key={apt.id.toString()} style={{ background: bg }}>
                  <td style={{ padding: "2px 4px", border: "1px solid #ddd" }}>
                    {dateStr}
                  </td>
                  <td style={{ padding: "2px 4px", border: "1px solid #ddd" }}>
                    {apt.heureDebut.replace(":", "h")}
                  </td>
                  <td
                    style={{
                      padding: "2px 4px",
                      textAlign: "right",
                      border: "1px solid #ddd",
                    }}
                  >
                    {Number(apt.montantDu).toLocaleString("fr-FR")}
                  </td>
                  <td
                    style={{
                      padding: "2px 4px",
                      textAlign: "right",
                      border: "1px solid #ddd",
                    }}
                  >
                    {Number(apt.montantPaye).toLocaleString("fr-FR")}
                  </td>
                  <td style={{ padding: "2px 4px", border: "1px solid #ddd" }}>
                    {payDate}
                  </td>
                  <td
                    style={{
                      padding: "2px 4px",
                      textAlign: "center",
                      border: "1px solid #ddd",
                      color: apt.annule ? "#c0392b" : "inherit",
                      fontStyle: apt.annule ? "italic" : "normal",
                    }}
                  >
                    {apt.annule ? "Annulé" : apt.fait ? "✓" : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── EditModal ─────────────────────────────────────────────────────────────────
interface EditFormState {
  apt: RendezVous;
  mode: "unique" | "futurs";
}

interface EditModalProps {
  state: EditFormState;
  onClose: () => void;
}

function EditModal({ state, onClose }: EditModalProps) {
  const { apt, mode } = state;
  const updateApt = useUpdateAppointment();

  const [heureDebut, setHeureDebut] = useState(apt.heureDebut);
  const [heureFin, setHeureFin] = useState(apt.heureFin);
  const [montantDu, setMontantDu] = useState(Number(apt.montantDu).toString());
  const [service, setService] = useState(apt.service);
  const [notes, setNotes] = useState(apt.notes);

  const handleSubmit = () => {
    updateApt.mutate(
      {
        id: apt.id,
        dateHeure: apt.dateHeure,
        heureDebut,
        heureFin,
        nomClient: apt.nomClient,
        referenceClient: apt.referenceClient,
        numeroTelephone: apt.numeroTelephone,
        adresse: apt.adresse,
        service,
        notes,
        montantDu: BigInt(Number.parseInt(montantDu, 10) || 0),
        repetition: apt.repetition as unknown as TypeRepetition,
        demandeEdition:
          mode === "unique"
            ? DemandeEdition.unique
            : DemandeEdition.futursDuClient,
        clientRef: { owner: apt.owner, referenceClient: apt.referenceClient },
      },
      { onSuccess: onClose },
    );
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "Verdana, sans-serif",
    fontSize: 12,
    display: "block",
    marginBottom: 2,
    fontWeight: "bold",
  };
  const inputStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: 3,
    padding: "2px 6px",
    fontFamily: "Verdana, sans-serif",
    fontSize: 12,
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 6,
          padding: 16,
          width: 320,
          fontFamily: "Verdana, sans-serif",
        }}
      >
        <div
          style={{
            fontWeight: "bold",
            fontSize: 13,
            marginBottom: 12,
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: 8,
          }}
        >
          {mode === "unique"
            ? "Modifier ce RDV"
            : "Modifier tous les futurs RDV"}
          <span
            style={{ fontWeight: "normal", color: "#6b7280", marginLeft: 6 }}
          >
            {apt.nomClient}
          </span>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <label htmlFor="daily-edit-heureDebut" style={labelStyle}>
              Heure début
            </label>
            <input
              id="daily-edit-heureDebut"
              type="time"
              value={heureDebut}
              onChange={(e) => setHeureDebut(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="daily-edit-heureFin" style={labelStyle}>
              Heure fin
            </label>
            <input
              id="daily-edit-heureFin"
              type="time"
              value={heureFin}
              onChange={(e) => setHeureFin(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="daily-edit-montantDu" style={labelStyle}>
              Montant dû
            </label>
            <input
              id="daily-edit-montantDu"
              type="number"
              value={montantDu}
              onChange={(e) => setMontantDu(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="daily-edit-service" style={labelStyle}>
              Service
            </label>
            <input
              id="daily-edit-service"
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="daily-edit-notes" style={labelStyle}>
              Notes
            </label>
            <textarea
              id="daily-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "4px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "Verdana, sans-serif",
              fontSize: 12,
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: "4px 12px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "Verdana, sans-serif",
              fontSize: 12,
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DailyCalendarPage ─────────────────────────────────────────────────────────
export default function DailyCalendarPage() {
  const { session } = useLocalAuth();
  const isReader = session?.role === "reader";
  const [dayOffset, setDayOffset] = useState(0);

  const [paymentDates, setPaymentDates] = useState<Map<string, string>>(() => {
    try {
      const raw = localStorage.getItem("weekly_payment_dates");
      return raw ? new Map(JSON.parse(raw)) : new Map();
    } catch {
      return new Map();
    }
  });

  const [contextMenu, setContextMenu] = useState<{
    apt: RendezVous;
    x: number;
    y: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [ficheClientRef, setFicheClientRef] = useState<{
    ref: string;
    name: string;
  } | null>(null);

  const { data: appointments = [] } = useGetAllAppointments();
  const { data: allClients = [] } = useGetAllClientRecords();
  const updateStatus = useUpdateAppointmentStatus();
  const updatePaye = useUpdateMontantPaye();
  const deleteApt = useDeleteAppointment();

  // Calculate the current day
  const today = new Date();
  const currentDay = new Date(today);
  currentDay.setDate(today.getDate() + dayOffset);
  currentDay.setHours(0, 0, 0, 0);

  const dayName = DAY_NAMES_FR[currentDay.getDay()];
  const dayLabel = `${dayName} ${currentDay.getDate()} ${MONTH_NAMES_FR[currentDay.getMonth()]} ${currentDay.getFullYear()}`;

  // Filter appointments for this day
  const dayApts = appointments.filter((apt) => {
    const d = new Date(Number(apt.dateHeure) / 1_000_000);
    return (
      d.getFullYear() === currentDay.getFullYear() &&
      d.getMonth() === currentDay.getMonth() &&
      d.getDate() === currentDay.getDate()
    );
  });

  // Build a map: heureDebut -> appointment (only first one per slot if multiple)
  const slotMap = new Map<string, RendezVous>();
  for (const apt of dayApts) {
    if (!slotMap.has(apt.heureDebut)) slotMap.set(apt.heureDebut, apt);
  }

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  const handlePaymentDateChange = useCallback((aptId: string, val: string) => {
    setPaymentDates((prev) => {
      const next = new Map(prev);
      next.set(aptId, val);
      localStorage.setItem(
        "weekly_payment_dates",
        JSON.stringify([...next.entries()]),
      );
      return next;
    });
  }, []);

  const handleFait = useCallback(
    (apt: RendezVous) => {
      if (isReader) return;
      updateStatus.mutate({ id: apt.id, fait: !apt.fait, annule: null });
    },
    [isReader, updateStatus],
  );

  const handleAnnule = useCallback(
    (apt: RendezVous) => {
      if (isReader) return;
      updateStatus.mutate({ id: apt.id, annule: !apt.annule, fait: null });
    },
    [isReader, updateStatus],
  );

  const handlePaye = useCallback(
    (apt: RendezVous, val: string) => {
      if (isReader || apt.annule) return;
      updatePaye.mutate({
        id: apt.id,
        montantPaye: BigInt(Math.max(0, Number.parseInt(val, 10) || 0)),
        referenceClient: apt.referenceClient,
      });
    },
    [isReader, updatePaye],
  );

  const handleNote = useCallback(
    (apt: RendezVous, val: string) => {
      if (isReader) return;
      updateStatus.mutate({ id: apt.id, commentaireManuel: val });
    },
    [isReader, updateStatus],
  );

  const handleDelete = useCallback(
    (apt: RendezVous) => {
      if (!window.confirm(`Supprimer le RDV de ${apt.nomClient} ?`)) return;
      deleteApt.mutate({ id: apt.id, mode: DemandeEdition.unique });
      setContextMenu(null);
    },
    [deleteApt],
  );

  const totalW = COLS.reduce((s, c) => s + c.w, 0);

  return (
    <div style={{ ...VERDANA, padding: 12 }}>
      <h1
        style={{
          fontFamily: "Verdana, sans-serif",
          fontSize: 14,
          fontWeight: "bold",
          marginBottom: 8,
        }}
      >
        Calendrier Journalier
      </h1>

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 11, color: "#666" }}>Page</span>
        <button
          type="button"
          onClick={() => setDayOffset((o) => o - 1)}
          style={{
            background: "none",
            border: "1px solid #d1d5db",
            borderRadius: 3,
            cursor: "pointer",
            padding: "1px 5px",
            display: "flex",
            alignItems: "center",
          }}
          data-ocid="daily.pagination_prev"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => setDayOffset(0)}
          style={{
            background: "none",
            border: "1px solid #d1d5db",
            borderRadius: 3,
            cursor: "pointer",
            padding: "1px 5px",
            fontSize: 11,
          }}
          data-ocid="daily.today.button"
        >
          Aujourd&apos;hui
        </button>
        <span
          style={{ fontWeight: "bold", fontSize: 12 }}
          data-ocid="daily.panel"
        >
          {dayLabel}
        </span>
        <button
          type="button"
          onClick={() => setDayOffset((o) => o + 1)}
          style={{
            background: "none",
            border: "1px solid #d1d5db",
            borderRadius: 3,
            cursor: "pointer",
            padding: "1px 5px",
            display: "flex",
            alignItems: "center",
          }}
          data-ocid="daily.pagination_next"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          border: "2px solid #9ca3af",
          borderRadius: 4,
          overflow: "hidden",
          display: "inline-block",
          maxWidth: "100%",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: totalW }}>
            {/* Column headers */}
            <div
              style={{
                display: "flex",
                background: "#f3f4f6",
                borderBottom: "1px solid #d1d5db",
              }}
            >
              {COLS.map((col, ci) => (
                <div
                  key={col.label}
                  style={{
                    ...colStyle(col.w, ci === COLS.length - 1),
                    fontWeight: "bold",
                    fontSize: 11,
                    textAlign: "center",
                    background: "#f3f4f6",
                  }}
                >
                  {col.label}
                </div>
              ))}
            </div>
            {/* Time slot rows */}
            {TIME_SLOTS.map((slot, idx) => {
              const apt = slotMap.get(slot) ?? null;
              const bg = idx % 2 === 0 ? "#fff" : "#f9f9f9";
              const nameBg = apt
                ? apt.annule
                  ? "#fce7f3"
                  : apt.fait
                    ? "#d1fae5"
                    : "#fff"
                : bg;
              const aptIdStr = apt ? apt.id.toString() : null;
              const slotLabel = slot.replace(":", "h");
              const isHour = slot.endsWith(":00");

              return (
                <div
                  key={slot}
                  style={{
                    display: "flex",
                    background: bg,
                    borderBottom: isHour
                      ? "1px solid #e5e7eb"
                      : "1px solid #f3f4f6",
                  }}
                >
                  {/* Heure */}
                  <div
                    style={{
                      ...colStyle(47),
                      textAlign: "center",
                      fontWeight: isHour ? "bold" : "normal",
                      color: isHour ? "#374151" : "#6b7280",
                    }}
                  >
                    {isHour ? (
                      slotLabel
                    ) : apt ? (
                      slotLabel
                    ) : (
                      <span style={{ color: "#d1d5db" }}>{slotLabel}</span>
                    )}
                  </div>
                  {/* Nom */}
                  <div
                    style={{
                      ...colStyle(100),
                      background: nameBg,
                      cursor: apt && !isReader ? "pointer" : "default",
                      userSelect: "none",
                    }}
                    role={apt && !isReader ? "button" : undefined}
                    tabIndex={apt && !isReader ? 0 : undefined}
                    onClick={
                      apt && !isReader
                        ? (e) => {
                            e.stopPropagation();
                            const rect = (
                              e.currentTarget as HTMLElement
                            ).getBoundingClientRect();
                            setContextMenu({
                              apt,
                              x: rect.left,
                              y: rect.bottom + 2,
                            });
                          }
                        : undefined
                    }
                    onKeyDown={
                      apt && !isReader
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              const rect = (
                                e.currentTarget as HTMLElement
                              ).getBoundingClientRect();
                              setContextMenu({
                                apt,
                                x: rect.left,
                                y: rect.bottom + 2,
                              });
                            }
                          }
                        : undefined
                    }
                    title={apt ? apt.nomClient : ""}
                    data-ocid={apt ? "daily.nom.button" : undefined}
                  >
                    {apt ? apt.nomClient : ""}
                  </div>
                  {/* Réf */}
                  <div style={{ ...colStyle(51) }}>
                    {apt ? apt.referenceClient : ""}
                  </div>
                  {/* F */}
                  <div
                    style={{
                      ...colStyle(24),
                      background: apt?.fait ? "#d1fae5" : bg,
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    {apt && (
                      <input
                        type="checkbox"
                        checked={apt.fait}
                        disabled={isReader}
                        onChange={() => handleFait(apt)}
                        style={{
                          cursor: isReader ? "default" : "pointer",
                          width: 10,
                          height: 10,
                        }}
                      />
                    )}
                  </div>
                  {/* A */}
                  <div
                    style={{
                      ...colStyle(24),
                      background: apt?.annule ? "#fce7f3" : bg,
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    {apt && (
                      <input
                        type="checkbox"
                        checked={apt.annule}
                        disabled={isReader}
                        onChange={() => handleAnnule(apt)}
                        style={{
                          cursor: isReader ? "default" : "pointer",
                          width: 10,
                          height: 10,
                        }}
                      />
                    )}
                  </div>
                  {/* Dû */}
                  <div style={{ ...colStyle(47), textAlign: "right" }}>
                    {apt ? Number(apt.montantDu).toString() : ""}
                  </div>
                  {/* Payé */}
                  <div style={{ ...colStyle(47), padding: 0 }}>
                    {apt && (
                      <input
                        type="number"
                        min={0}
                        value={apt.annule ? 0 : Number(apt.montantPaye)}
                        disabled={isReader || apt.annule}
                        onChange={(e) => handlePaye(apt, e.target.value)}
                        style={{
                          border: "none",
                          background: "transparent",
                          width: "100%",
                          height: ROW_H,
                          padding: "0 2px",
                          fontFamily: "Verdana, sans-serif",
                          fontSize: 12,
                          textAlign: "right",
                          outline: "none",
                        }}
                      />
                    )}
                  </div>
                  {/* Date paiement */}
                  <div style={{ ...colStyle(40), padding: 0 }}>
                    {apt && (
                      <input
                        type="text"
                        placeholder="JJ/MM"
                        value={
                          aptIdStr ? (paymentDates.get(aptIdStr) ?? "") : ""
                        }
                        disabled={isReader}
                        onChange={(e) =>
                          aptIdStr &&
                          handlePaymentDateChange(aptIdStr, e.target.value)
                        }
                        maxLength={5}
                        style={{
                          border: "none",
                          background: "transparent",
                          width: "100%",
                          height: ROW_H,
                          padding: "0 2px",
                          fontFamily: "Verdana, sans-serif",
                          fontSize: 12,
                          outline: "none",
                        }}
                      />
                    )}
                  </div>
                  {/* Note */}
                  <div style={{ ...colStyle(74, true), padding: 0 }}>
                    {apt && (
                      <input
                        type="text"
                        value={apt.commentaireManuel ?? ""}
                        disabled={isReader}
                        onChange={(e) => handleNote(apt, e.target.value)}
                        style={{
                          border: "none",
                          background: "transparent",
                          width: "100%",
                          height: ROW_H,
                          padding: "0 2px",
                          fontFamily: "Verdana, sans-serif",
                          fontSize: 12,
                          outline: "none",
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 9999,
            minWidth: 200,
            fontFamily: "Verdana, sans-serif",
            fontSize: 12,
          }}
        >
          {[
            {
              label: "Modifier ce RDV",
              action: () => {
                setEditForm({ apt: contextMenu.apt, mode: "unique" });
                setContextMenu(null);
              },
            },
            {
              label: "Modifier tous les futurs RDV",
              action: () => {
                setEditForm({ apt: contextMenu.apt, mode: "futurs" });
                setContextMenu(null);
              },
            },
            {
              label: "Supprimer ce RDV",
              action: () => handleDelete(contextMenu.apt),
              danger: true,
            },
            {
              label: "Voir la fiche client",
              action: () => {
                setFicheClientRef({
                  ref: contextMenu.apt.referenceClient,
                  name: contextMenu.apt.nomClient,
                });
                setContextMenu(null);
              },
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 12px",
                cursor: "pointer",
                color: (item as { danger?: boolean }).danger
                  ? "#dc2626"
                  : "#111",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #f3f4f6",
                fontFamily: "Verdana, sans-serif",
                fontSize: 12,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editForm && (
        <EditModal state={editForm} onClose={() => setEditForm(null)} />
      )}

      {/* Client fiche modal */}
      {ficheClientRef && (
        <ClientFicheModal
          referenceClient={ficheClientRef.ref}
          clientName={ficheClientRef.name}
          clients={allClients}
          appointments={appointments}
          onClose={() => setFicheClientRef(null)}
        />
      )}
    </div>
  );
}
