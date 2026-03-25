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
  useUpdateAppointmentStatus,
  useUpdateMontantPaye,
} from "../hooks/useQueries";

const VERDANA: React.CSSProperties = {
  fontFamily: "Verdana, sans-serif",
  fontSize: 12,
};
const ROW_H = 12;
const MAX_ROWS = 10;

const DAY_NAMES = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];
const MONTH_NAMES = [
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

function getWeekDates(weekOffset: number): Date[] {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatHeure(h: string): string {
  return h.replace(":", "h");
}
function aptDate(apt: RendezVous): Date {
  return new Date(Number(apt.dateHeure) / 1_000_000);
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface ContextMenuState {
  apt: RendezVous;
  x: number;
  y: number;
}

// Column definitions — widths used for header AND cells
const DAY_COLS = [
  { key: "heure", label: "Heure", w: 51 },
  { key: "nom", label: "Nom", w: 88 },
  { key: "ref", label: "Réf", w: 51 },
  { key: "f", label: "F", w: 24 },
  { key: "a", label: "A", w: 24 },
  { key: "du", label: "Dû", w: 44 },
  { key: "paye", label: "Payé", w: 44 },
  { key: "date", label: "Date", w: 44 },
  // Note is flex:1 (fills remaining width)
  { key: "note", label: "Note", w: 74 },
];
// Fixed total of first 8 cols
const FIXED_W = DAY_COLS.slice(0, 8).reduce((s, c) => s + c.w, 0); // 415

function colStyle(
  w: number,
  flex?: boolean,
  last = false,
): React.CSSProperties {
  return {
    ...(flex
      ? { flex: 1, minWidth: w }
      : { width: w, minWidth: w, maxWidth: w }),
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

interface DayBoxProps {
  date: Date;
  appointments: RendezVous[];
  isReader: boolean;
  paymentDates: Map<string, string>;
  onPaymentDateChange: (aptId: string, val: string) => void;
  onOpenEdit: (apt: RendezVous, mode: "unique" | "futurs") => void;
  onDelete: (apt: RendezVous) => void;
  onViewClient: (referenceClient: string, clientName: string) => void;
}

function DayBox({
  date,
  appointments,
  isReader,
  paymentDates,
  onPaymentDateChange,
  onOpenEdit,
  onDelete,
  onViewClient,
}: DayBoxProps) {
  const updateStatus = useUpdateAppointmentStatus();
  const updatePaye = useUpdateMontantPaye();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editingPaye, setEditingPaye] = useState<{
    id: string;
    val: string;
  } | null>(null);

  const dayApts = appointments
    .filter((a) => sameDay(aptDate(a), date))
    .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
    .slice(0, MAX_ROWS);

  const rows: (RendezVous | null)[] = [
    ...dayApts,
    ...Array(Math.max(0, MAX_ROWS - dayApts.length)).fill(null),
  ];
  const dayLabel = `${DAY_NAMES[(date.getDay() + 6) % 7]} ${date.getDate()}`;
  const isToday = sameDay(date, new Date());

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

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
      if (isReader) return;
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

  const handleNomClick = (e: React.MouseEvent, apt: RendezVous) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ apt, x: rect.left, y: rect.bottom + 2 });
  };

  return (
    <div
      style={{
        border: "2px solid #9ca3af",
        borderRadius: 4,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Day header */}
      <div
        style={{
          background: isToday ? "#fef9c3" : "#dbeafe",
          fontWeight: "bold",
          textAlign: "center",
          height: ROW_H,
          lineHeight: `${ROW_H}px`,
          fontSize: 12,
          fontFamily: "Verdana, sans-serif",
          borderBottom: "1px solid #9ca3af",
        }}
      >
        {dayLabel}
      </div>
      {/* Scrollable table */}
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            minWidth: FIXED_W + 74,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Column headers */}
          <div
            style={{
              display: "flex",
              background: "#f3f4f6",
              borderBottom: "1px solid #d1d5db",
            }}
          >
            {DAY_COLS.map((col, ci) => (
              <div
                key={col.key}
                style={{
                  ...colStyle(
                    col.w,
                    ci === DAY_COLS.length - 1,
                    ci === DAY_COLS.length - 1,
                  ),
                  fontWeight: "bold",
                  fontSize: 11,
                  background: "#f3f4f6",
                  textAlign: "center",
                  ...(ci === DAY_COLS.length - 1
                    ? { flex: 1, minWidth: col.w }
                    : {}),
                }}
              >
                {col.label}
              </div>
            ))}
          </div>
          {/* Data rows */}
          {rows.map((apt, idx) => {
            const bg = idx % 2 === 0 ? "#fff" : "#f9f9f9";
            const nameBg = apt
              ? apt.annule
                ? "#fce7f3"
                : apt.fait
                  ? "#d1fae5"
                  : "#fff"
              : bg;
            const rowKey = apt ? `apt-${apt.id.toString()}` : `empty-${idx}`;
            const aptIdStr = apt ? apt.id.toString() : null;
            return (
              <div
                key={rowKey}
                style={{
                  display: "flex",
                  background: bg,
                  borderBottom:
                    idx < rows.length - 1 ? "1px solid #e5e7eb" : "none",
                }}
              >
                {/* Heure */}
                <div style={{ ...colStyle(51), textAlign: "center" }}>
                  {apt ? formatHeure(apt.heureDebut) : ""}
                </div>
                {/* Nom */}
                <div
                  style={{
                    ...colStyle(88),
                    background: nameBg,
                    cursor: apt && !isReader ? "pointer" : "default",
                    userSelect: "none",
                  }}
                  role={apt && !isReader ? "button" : undefined}
                  tabIndex={apt && !isReader ? 0 : undefined}
                  onClick={
                    apt && !isReader ? (e) => handleNomClick(e, apt) : undefined
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
                <div style={{ ...colStyle(44), textAlign: "right" }}>
                  {apt ? Number(apt.montantDu).toString() : ""}
                </div>
                {/* Payé — width 44, no spinner (type=text) */}
                <div style={{ ...colStyle(44), padding: 0 }}>
                  {apt && (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        editingPaye?.id === apt.id.toString()
                          ? editingPaye.val
                          : Number(apt.montantPaye).toString()
                      }
                      disabled={isReader}
                      onFocus={(e) => {
                        setEditingPaye({
                          id: apt.id.toString(),
                          val: Number(apt.montantPaye).toString(),
                        });
                        e.currentTarget.select();
                      }}
                      onChange={(e) => {
                        setEditingPaye({
                          id: apt.id.toString(),
                          val: e.target.value,
                        });
                      }}
                      onBlur={(e) => {
                        handlePaye(apt, e.target.value);
                        setEditingPaye(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handlePaye(apt, e.currentTarget.value);
                          setEditingPaye(null);
                          e.currentTarget.blur();
                        }
                      }}
                      onFocusCapture={(e) => {
                        e.currentTarget.style.outline = "1px solid #3b82f6";
                      }}
                      onBlurCapture={(e) => {
                        e.currentTarget.style.outline = "none";
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        width: 40,
                        height: ROW_H,
                        padding: "0 2px",
                        fontFamily: "Verdana, sans-serif",
                        fontSize: 12,
                        textAlign: "right",
                        outline: "none",
                        cursor: "text",
                      }}
                    />
                  )}
                </div>
                {/* Date — width 52 */}
                <div style={{ ...colStyle(44), padding: 0 }}>
                  {apt && (
                    <input
                      type="text"
                      placeholder="JJ/MM"
                      value={aptIdStr ? (paymentDates.get(aptIdStr) ?? "") : ""}
                      disabled={isReader}
                      onChange={(e) =>
                        aptIdStr &&
                        onPaymentDateChange(aptIdStr, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      maxLength={5}
                      style={{
                        border: "none",
                        background: "transparent",
                        width: 52,
                        height: ROW_H,
                        padding: "0 2px",
                        fontFamily: "Verdana, sans-serif",
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                  )}
                </div>
                {/* Note — flex:1, fills remaining width */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 74,
                    height: ROW_H,
                    lineHeight: `${ROW_H}px`,
                    overflow: "hidden",
                    padding: 0,
                    boxSizing: "border-box",
                  }}
                >
                  {apt && (
                    <input
                      type="text"
                      value={apt.commentaireManuel ?? ""}
                      disabled={isReader}
                      onChange={(e) => handleNote(apt, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleNote(apt, e.currentTarget.value);
                          e.currentTarget.blur();
                        }
                      }}
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
                onOpenEdit(contextMenu.apt, "unique");
                setContextMenu(null);
              },
            },
            {
              label: "Modifier tous les futurs RDV",
              action: () => {
                onOpenEdit(contextMenu.apt, "futurs");
                setContextMenu(null);
              },
            },
            {
              label: "Supprimer ce RDV",
              action: () => {
                onDelete(contextMenu.apt);
                setContextMenu(null);
              },
              danger: true,
            },
            {
              label: "Voir la fiche client",
              action: () => {
                onViewClient(
                  contextMenu.apt.referenceClient,
                  contextMenu.apt.nomClient,
                );
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
    </div>
  );
}

function SummaryBox({
  weekDates,
  allAppointments,
}: { weekDates: Date[]; allAppointments: RendezVous[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const weekApts = allAppointments.filter((a) => {
    const d = aptDate(a);
    return (
      d >= weekStart &&
      d <=
        new Date(
          weekEnd.getFullYear(),
          weekEnd.getMonth(),
          weekEnd.getDate(),
          23,
          59,
          59,
        )
    );
  });
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  const monthApts = allAppointments.filter((a) => {
    const d = aptDate(a);
    return d >= monthStart && d <= monthEnd;
  });
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const yearApts = allAppointments.filter((a) => {
    const d = aptDate(a);
    return d >= yearStart && d <= yearEnd;
  });

  const totalSemaineFaitPaye = weekApts
    .filter((a) => a.fait && !a.annule)
    .reduce((s, a) => s + Number(a.montantPaye), 0);
  const totalSemaineFaitImpaye = weekApts
    .filter((a) => a.fait && !a.annule)
    .reduce((s, a) => s + Number(a.montantDu), 0);
  const totalMensuelPaye = monthApts
    .filter((a) => a.fait && !a.annule)
    .reduce((s, a) => s + Number(a.montantPaye), 0);

  const weeksWithRdv = new Set<string>();
  for (const a of monthApts) {
    if (a.fait && !a.annule) {
      const d = aptDate(a);
      const day = d.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diffToMon);
      weeksWithRdv.add(
        `${mon.getFullYear()}-${mon.getMonth()}-${mon.getDate()}`,
      );
    }
  }
  const moyMensuel =
    weeksWithRdv.size > 0
      ? Math.round(totalMensuelPaye / weeksWithRdv.size)
      : 0;
  const totalAnneePaye = yearApts
    .filter((a) => a.fait && !a.annule)
    .reduce((s, a) => s + Number(a.montantPaye), 0);
  const totalDu = weekApts
    .filter(
      (a) => a.fait && !a.annule && Number(a.montantPaye) < Number(a.montantDu),
    )
    .reduce((s, a) => s + (Number(a.montantDu) - Number(a.montantPaye)), 0);

  const summaryRows = [
    {
      key: "sem-paye",
      label: "Total semaine",
      value: totalSemaineFaitPaye,
      sub: "Fait et payé",
      red: false,
    },
    {
      key: "sem-impaye",
      label: "Total semaine",
      value: totalSemaineFaitImpaye,
      sub: "Fait payé/impayé",
      red: false,
    },
    {
      key: "mois-paye",
      label: "Total Mensuel",
      value: totalMensuelPaye,
      sub: "Fait et payé",
      red: false,
    },
    {
      key: "mois-moy",
      label: "Moy Mensuel",
      value: moyMensuel,
      sub: "Fait et payé",
      red: false,
    },
    {
      key: "annee-paye",
      label: "Total Année",
      value: totalAnneePaye,
      sub: "Fait et payé",
      red: false,
    },
    { key: "du", label: "Dû", value: totalDu, sub: "", red: true },
  ];

  return (
    <div
      style={{
        border: "2px solid #9ca3af",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#dbeafe",
          fontWeight: "bold",
          textAlign: "center",
          height: ROW_H,
          lineHeight: `${ROW_H}px`,
          fontSize: 12,
          fontFamily: "Verdana, sans-serif",
          borderBottom: "1px solid #9ca3af",
        }}
      >
        Résumé
      </div>
      <div
        style={{
          height: ROW_H,
          background: "#f3f4f6",
          borderBottom: "1px solid #d1d5db",
        }}
      />
      {summaryRows.map((row, i) => (
        <div
          key={row.key}
          style={{
            display: "flex",
            alignItems: "center",
            minHeight: 18,
            height: "auto",
            background: i % 2 === 0 ? "#fff" : "#f9f9f9",
            borderBottom:
              i < summaryRows.length - 1 ? "1px solid #e5e7eb" : "none",
            padding: "2px 4px",
            fontFamily: "Verdana, sans-serif",
            fontSize: 12,
          }}
        >
          {/* Label right-aligned so all ":" are on same position */}
          <span
            style={{
              width: 110,
              textAlign: "right",
              fontWeight: "bold",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {row.label} :
          </span>
          <span
            style={{
              marginLeft: 4,
              fontWeight: "bold",
              color: row.red ? "#dc2626" : "#111",
              flexShrink: 0,
            }}
          >
            {row.value}
          </span>
          {row.sub && (
            <span style={{ marginLeft: 4, color: "#6b7280", fontSize: 11 }}>
              {row.sub}
            </span>
          )}
        </div>
      ))}
      {Array(Math.max(0, MAX_ROWS - summaryRows.length))
        .fill(0)
        .map((_, i) => (
          <div
            key={`fill-row-${summaryRows.length + i}`}
            style={{
              height: ROW_H,
              background:
                (summaryRows.length + i) % 2 === 0 ? "#fff" : "#f9f9f9",
            }}
          />
        ))}
    </div>
  );
}

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

  const clientApts = allApts
    .filter(
      (apt) =>
        apt.referenceClient === referenceClient &&
        apt.dateHeure >= startOfYear &&
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
          width: 460,
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
                  <td style={{ padding: "2px 4px", border: "1px solid #ddd" }}>
                    {apt.commentaireManuel ?? ""}
                  </td>
                  <td
                    style={{
                      padding: "2px 4px",
                      textAlign: "right",
                      border: "1px solid #ddd",
                      color:
                        Number(apt.montantPaye) -
                          (apt.fait ? Number(apt.montantDu) : 0) >=
                        0
                          ? "#27ae60"
                          : "#c0392b",
                    }}
                  >
                    {(
                      Number(apt.montantPaye) -
                      (apt.fait ? Number(apt.montantDu) : 0)
                    ).toLocaleString("fr-FR")}
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

export default function WeeklyCalendarPage() {
  const { session } = useLocalAuth();
  const isReader = session?.role === "reader";
  const [weekOffset, setWeekOffset] = useState(0);
  const [paymentDates, setPaymentDates] = useState<Map<string, string>>(() => {
    try {
      const raw = localStorage.getItem("weekly_payment_dates");
      return raw ? new Map(JSON.parse(raw)) : new Map();
    } catch {
      return new Map();
    }
  });
  const [editForm, setEditForm] = useState<{
    apt: RendezVous;
    mode: "unique" | "futurs";
  } | null>(null);
  const [ficheClientRef, setFicheClientRef] = useState<{
    ref: string;
    name: string;
  } | null>(null);
  const deleteApt = useDeleteAppointment();

  const { data: appointments = [] } = useGetAllAppointments();
  const { data: allClients = [] } = useGetAllClientRecords();

  const weekDates = getWeekDates(weekOffset);
  const firstDate = weekDates[0];
  const lastDate = weekDates[6];

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

  const handleOpenEdit = useCallback(
    (apt: RendezVous, mode: "unique" | "futurs") => setEditForm({ apt, mode }),
    [],
  );

  const handleDelete = useCallback(
    (apt: RendezVous) => {
      if (!window.confirm(`Supprimer le RDV de ${apt.nomClient} ?`)) return;
      deleteApt.mutate({ id: apt.id, mode: DemandeEdition.unique });
    },
    [deleteApt],
  );

  const handleViewClient = useCallback(
    (referenceClient: string, clientName: string) => {
      setFicheClientRef({ ref: referenceClient, name: clientName });
    },
    [],
  );

  const dayKeys = weekDates.map(
    (d) => `day-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
  );

  return (
    <div style={{ ...VERDANA, padding: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          marginBottom: 12,
          fontFamily: "Verdana, sans-serif",
          fontSize: 12,
          fontWeight: "bold",
        }}
      >
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o - 1)}
          style={{
            background: "none",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            padding: "2px 6px",
            display: "flex",
            alignItems: "center",
          }}
          data-ocid="weekly.pagination_prev"
        >
          <ChevronLeft size={16} />
        </button>
        <span data-ocid="weekly.panel">
          Semaine du {firstDate.getDate()} {MONTH_NAMES[firstDate.getMonth()]} —{" "}
          {lastDate.getDate()} {MONTH_NAMES[lastDate.getMonth()]}{" "}
          {lastDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o + 1)}
          style={{
            background: "none",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            padding: "2px 6px",
            display: "flex",
            alignItems: "center",
          }}
          data-ocid="weekly.pagination_next"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => setWeekOffset(0)}
          style={{
            background: "none",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            cursor: "pointer",
            padding: "2px 6px",
            fontFamily: "Verdana, sans-serif",
            fontSize: 12,
          }}
          data-ocid="weekly.today.button"
        >
          Aujourd'hui
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(min(100%, 510px), 1fr))",
          gap: 8,
        }}
      >
        {weekDates.map((date, i) => (
          <DayBox
            key={dayKeys[i]}
            date={date}
            appointments={appointments}
            isReader={isReader}
            paymentDates={paymentDates}
            onPaymentDateChange={handlePaymentDateChange}
            onOpenEdit={handleOpenEdit}
            onDelete={handleDelete}
            onViewClient={handleViewClient}
          />
        ))}
        <SummaryBox weekDates={weekDates} allAppointments={appointments} />
      </div>

      {editForm && (
        <AppointmentDialog
          open={true}
          onClose={() => setEditForm(null)}
          appointment={editForm.apt}
          editMode={
            editForm.mode === "unique"
              ? DemandeEdition.unique
              : DemandeEdition.futursDuClient
          }
        />
      )}
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
