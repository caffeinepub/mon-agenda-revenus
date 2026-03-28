import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientRecord, RendezVous } from "../backend";
import { DemandeEdition } from "../backend";
import AppointmentDialog from "../components/AppointmentDialog";
import { useLocalAuth } from "../context/LocalAuthContext";
import {
  useDeleteAppointment,
  useGetAllAppointments,
  useGetAllClientRecords,
} from "../hooks/useQueries";

const COL_W = 87;
const ROW_H = 14;
const VERDANA10: React.CSSProperties = {
  fontFamily: "Verdana, sans-serif",
  fontSize: 10,
  fontWeight: "normal",
};

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
const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Returns Monday-based calendar weeks for a given month
function getCalendarWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-based day index: Mon=0 ... Sun=6
  const firstDow = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(1 - firstDow);

  const weeks: Date[][] = [];
  const d = new Date(startDate);
  while (d <= lastDay || weeks.length === 0) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
    if (d > lastDay) break;
  }
  return weeks;
}

// ── ClientFicheModal (inline) ─────────────────────────────────────────────────
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

  // Sort ascending for cumulative credit computation
  const clientAptsAscending = allApts
    .filter(
      (apt) =>
        apt.referenceClient === referenceClient &&
        apt.dateHeure >= startOfYear &&
        apt.dateHeure <= now,
    )
    .sort((a, b) => Number(a.dateHeure) - Number(b.dateHeure));

  // Compute cumulative credits: credit_i = credit_{i-1} + paid_i - due_i
  let runningCredit = 0;
  const aptsWithCredit = clientAptsAscending.map((apt) => {
    runningCredit =
      runningCredit + Number(apt.montantPaye) - Number(apt.montantDu);
    return { apt, credit: runningCredit };
  });

  // Display newest first
  const clientApts = [...aptsWithCredit].reverse();
  // Total credit = most recent running credit
  const totalCredit =
    aptsWithCredit.length > 0
      ? aptsWithCredit[aptsWithCredit.length - 1].credit
      : 0;
  const totalPaye = clientAptsAscending.reduce(
    (s, a) => s + Number(a.montantPaye),
    0,
  );
  const totalDu = clientAptsAscending
    .filter((a) => a.fait)
    .reduce((s, a) => s + Number(a.montantDu), 0);

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
          width: 480,
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
              {clientAptsAscending.filter((a) => a.fait).length}
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
              {[
                "Date",
                "Heure",
                "Dû",
                "Payé",
                "Date",
                "Note",
                "Crédit",
                "Fait",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "2px 4px",
                    textAlign:
                      h === "Dû" || h === "Payé" || h === "Crédit"
                        ? "right"
                        : "left",
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
            <tr style={{ background: "#e8e8e8" }}>
              <td style={{ padding: "2px 4px", border: "1px solid #ddd" }} />
              <td style={{ padding: "2px 4px", border: "1px solid #ddd" }} />
              <td style={{ padding: "2px 4px", border: "1px solid #ddd" }} />
              <td style={{ padding: "2px 4px", border: "1px solid #ddd" }} />
              <td style={{ padding: "2px 4px", border: "1px solid #ddd" }} />
              <td style={{ padding: "2px 4px", border: "1px solid #ddd" }} />
              <td
                style={{
                  padding: "2px 4px",
                  textAlign: "right",
                  border: "1px solid #ddd",
                  fontWeight: "bold",
                  color: totalCredit >= 0 ? "#27ae60" : "#c0392b",
                }}
              >
                {totalCredit.toLocaleString("fr-FR")}
              </td>
              <td style={{ padding: "2px 4px", border: "1px solid #ddd" }} />
            </tr>
          </tbody>
          <tbody>
            {clientApts.map(({ apt, credit }, idx) => {
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
                  <td style={{ padding: "2px 4px", border: "1px solid #ddd" }}>
                    {apt.commentaireManuel ?? ""}
                  </td>
                  <td
                    style={{
                      padding: "2px 4px",
                      textAlign: "right",
                      border: "1px solid #ddd",
                      color: credit >= 0 ? "#27ae60" : "#c0392b",
                    }}
                  >
                    {credit.toLocaleString("fr-FR")}
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

// ── MonthlyCalendarPage ───────────────────────────────────────────────────────
export default function MonthlyCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [clientExtraFields, setClientExtraFields] = useState<
    Record<string, { prenom?: string }>
  >({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("agenda_client_extra_fields");
      if (raw) setClientExtraFields(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const getDisplayName = useCallback(
    (ref: string, name: string): string => {
      const prenom = clientExtraFields[ref]?.prenom;
      return prenom ? `${prenom}, ${name}` : name;
    },
    [clientExtraFields],
  );
  const [ficheClient, setFicheClient] = useState<{
    ref: string;
    name: string;
  } | null>(null);

  const { session } = useLocalAuth();
  const isReader = session?.role === "reader";
  const deleteApt = useDeleteAppointment();
  const [contextMenu, setContextMenu] = useState<{
    apt: RendezVous;
    x: number;
    y: number;
  } | null>(null);
  const [editForm, setEditForm] = useState<{
    apt: RendezVous;
    mode: "unique" | "futurs";
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  const { data: appointments = [] } = useGetAllAppointments();
  const { data: allClients = [] } = useGetAllClientRecords();

  const weeks = getCalendarWeeks(year, month);

  // Build map: dateKey -> RendezVous[]
  const aptsByDate = new Map<string, RendezVous[]>();
  for (const apt of appointments) {
    const d = new Date(Number(apt.dateHeure) / 1_000_000);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!aptsByDate.has(key)) aptsByDate.set(key, []);
    aptsByDate.get(key)!.push(apt);
  }

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const cellBase: React.CSSProperties = {
    width: COL_W,
    minWidth: COL_W,
    maxWidth: COL_W,
    borderRight: "1px solid #d1d5db",
    boxSizing: "border-box",
    overflow: "hidden",
    verticalAlign: "top",
    fontFamily: "Verdana, sans-serif",
    fontSize: 10,
  };

  return (
    <div
      style={{ padding: 12, fontFamily: "Verdana, sans-serif", fontSize: 10 }}
    >
      <h1
        style={{
          fontFamily: "Verdana, sans-serif",
          fontSize: 13,
          fontWeight: "bold",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        Calendrier Mensuel
      </h1>

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 10, color: "#666" }}>Page</span>
        <button
          type="button"
          onClick={prevMonth}
          style={{
            background: "none",
            border: "1px solid #d1d5db",
            borderRadius: 3,
            cursor: "pointer",
            padding: "1px 6px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ChevronLeft size={13} />
        </button>
        <span
          style={{
            fontWeight: "bold",
            fontSize: 12,
            minWidth: 140,
            textAlign: "center",
          }}
        >
          {MONTH_NAMES_FR[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          style={{
            background: "none",
            border: "1px solid #d1d5db",
            borderRadius: 3,
            cursor: "pointer",
            padding: "1px 6px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
          fontSize: 10,
          fontFamily: "Verdana, sans-serif",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            background: "#e5e7eb",
            padding: "1px 8px",
            borderRadius: 2,
            border: "1px solid #d1d5db",
          }}
        >
          Non traité
        </span>
        <span
          style={{
            background: "#bbf7d0",
            padding: "1px 8px",
            borderRadius: 2,
            border: "1px solid #86efac",
          }}
        >
          Fait
        </span>
        <span
          style={{
            background: "#fce7f3",
            padding: "1px 8px",
            borderRadius: 2,
            border: "1px solid #f9a8d4",
          }}
        >
          Annulé
        </span>
        <span
          style={{
            background: "#fef08a",
            padding: "1px 8px",
            borderRadius: 2,
            border: "1px solid #fde047",
          }}
        >
          Aujourd'hui
        </span>
      </div>

      {/* Calendar table */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            overflowX: "auto",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table
            style={{
              borderCollapse: "collapse",
              tableLayout: "fixed",
              width: COL_W * 7,
            }}
          >
            {/* Day name header */}
            <thead>
              <tr style={{ background: "#dbeafe" }}>
                {DAY_SHORT.map((day, di) => (
                  <th
                    key={day}
                    style={{
                      ...cellBase,
                      height: ROW_H,
                      lineHeight: `${ROW_H}px`,
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: 10,
                      borderBottom: "2px solid #9ca3af",
                      borderRight: di < 6 ? "1px solid #d1d5db" : "none",
                      padding: 0,
                    }}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, _wi) => {
                // Collect all appointments for this week, find max per day
                const dayApts: RendezVous[][] = week.map((d) => {
                  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                  return (aptsByDate.get(key) ?? []).sort((a, b) =>
                    a.heureDebut.localeCompare(b.heureDebut),
                  );
                });
                const maxApts = Math.max(0, ...dayApts.map((a) => a.length));
                const isCurrentMonth = (d: Date) => d.getMonth() === month;

                return (
                  <>
                    {/* Date number row */}
                    <tr
                      key={`week-${week[0].getFullYear()}-${week[0].getMonth()}-${week[0].getDate()}-date`}
                      style={{ background: "#f0f4ff" }}
                    >
                      {week.map((d, di) => {
                        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                        const isToday = key === todayKey;
                        const inMonth = isCurrentMonth(d);
                        const isSun = di === 6;
                        return (
                          <td
                            key={`date-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
                            style={{
                              ...cellBase,
                              height: ROW_H,
                              lineHeight: `${ROW_H}px`,
                              textAlign: "center",
                              fontWeight: "bold",
                              fontSize: 10,
                              background: isToday
                                ? "#fef08a"
                                : isSun
                                  ? "#fce7f3"
                                  : inMonth
                                    ? "#e0f2fe"
                                    : "#f3f4f6",
                              color: inMonth ? "#111" : "#9ca3af",
                              borderBottom: "1px solid #9ca3af",
                              borderRight:
                                di < 6 ? "1px solid #d1d5db" : "none",
                              padding: 0,
                            }}
                          >
                            {d.getDate()}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Appointment rows */}
                    {Array.from({ length: Math.max(maxApts, 1) }).map(
                      (_, rowI) => (
                        <tr
                          key={`week-${week[0].getFullYear()}-${week[0].getMonth()}-${week[0].getDate()}-apt-${rowI}`}
                        >
                          {week.map((d, di) => {
                            const apt = dayApts[di][rowI] ?? null;
                            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                            const isToday = key === todayKey;
                            const isSun = di === 6;
                            const inMonth = isCurrentMonth(d);
                            const aptBg = apt
                              ? apt.annule
                                ? "#fce7f3"
                                : apt.fait
                                  ? "#bbf7d0"
                                  : "#e5e7eb"
                              : isToday
                                ? "#fef9c3"
                                : isSun
                                  ? "#fdf2f8"
                                  : inMonth
                                    ? "#fff"
                                    : "#fafafa";
                            return (
                              <td
                                key={`apt-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${rowI}`}
                                style={{
                                  ...cellBase,
                                  height: ROW_H,
                                  lineHeight: `${ROW_H}px`,
                                  background: aptBg,
                                  borderRight:
                                    di < 6 ? "1px solid #d1d5db" : "none",
                                  borderBottom: "1px solid #e5e7eb",
                                  padding: "0 2px",
                                  cursor: apt ? "pointer" : "default",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={
                                  apt
                                    ? `${apt.nomClient} — ${apt.heureDebut}`
                                    : ""
                                }
                                onClick={
                                  apt
                                    ? (e) => {
                                        e.preventDefault();
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
                                  apt
                                    ? (e) => {
                                        if (
                                          e.key === "Enter" ||
                                          e.key === " "
                                        ) {
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
                                role={apt ? "button" : undefined}
                                tabIndex={apt ? 0 : undefined}
                              >
                                {apt ? (
                                  <span
                                    style={{
                                      ...VERDANA10,
                                      cursor: "pointer",
                                      display: "block",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {getDisplayName(
                                      apt.referenceClient,
                                      apt.nomClient,
                                    )}
                                  </span>
                                ) : (
                                  ""
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ),
                    )}
                    {/* Separator row between weeks */}
                    <tr
                      key={`week-${week[0].getFullYear()}-${week[0].getMonth()}-${week[0].getDate()}-sep`}
                    >
                      <td
                        colSpan={7}
                        style={{ height: 2, background: "#9ca3af", padding: 0 }}
                      />
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {ficheClient && (
        <ClientFicheModal
          referenceClient={ficheClient.ref}
          clientName={ficheClient.name}
          clients={allClients}
          appointments={appointments}
          onClose={() => setFicheClient(null)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 9999,
            minWidth: 200,
            fontFamily: "Verdana, sans-serif",
            fontSize: 12,
          }}
        >
          {!isReader && (
            <>
              <button
                type="button"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 16px",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 12,
                }}
                onClick={() => {
                  setEditForm({ apt: contextMenu.apt, mode: "unique" });
                  setContextMenu(null);
                }}
              >
                ✏️ Modifier ce RDV
              </button>
              <button
                type="button"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 16px",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 12,
                }}
                onClick={() => {
                  setEditForm({ apt: contextMenu.apt, mode: "futurs" });
                  setContextMenu(null);
                }}
              >
                📅 Modifier tous les futurs RDV
              </button>
              <button
                type="button"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 16px",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  color: "#dc2626",
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 12,
                }}
                onClick={() => {
                  if (
                    window.confirm(
                      `Supprimer le RDV de ${contextMenu.apt.nomClient} ?`,
                    )
                  ) {
                    deleteApt.mutate({
                      id: contextMenu.apt.id,
                      mode: DemandeEdition.unique,
                    });
                  }
                  setContextMenu(null);
                }}
              >
                🗑️ Supprimer ce RDV
              </button>
              <button
                type="button"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 16px",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  color: "#dc2626",
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 12,
                }}
                onClick={() => {
                  if (
                    window.confirm(
                      `Supprimer TOUS les RDV futurs de ${contextMenu.apt.nomClient} ?`,
                    )
                  ) {
                    deleteApt.mutate({
                      id: contextMenu.apt.id,
                      mode: DemandeEdition.futursDuClient,
                    });
                  }
                  setContextMenu(null);
                }}
              >
                🗑️ Supprimer tous les RDV futurs
              </button>
              <div style={{ borderTop: "1px solid #e5e7eb" }} />
            </>
          )}
          <button
            type="button"
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "8px 16px",
              cursor: "pointer",
              background: "none",
              border: "none",
              fontFamily: "Verdana, sans-serif",
              fontSize: 12,
            }}
            onClick={() => {
              setFicheClient({
                ref: contextMenu.apt.referenceClient,
                name: contextMenu.apt.nomClient,
              });
              setContextMenu(null);
            }}
          >
            👤 Voir la fiche client
          </button>
        </div>
      )}

      {/* Edit dialog */}
      {editForm && (
        <AppointmentDialog
          open={true}
          appointment={editForm.apt}
          editMode={
            editForm.mode === "futurs"
              ? DemandeEdition.futursDuClient
              : DemandeEdition.unique
          }
          onClose={() => setEditForm(null)}
        />
      )}
    </div>
  );
}
