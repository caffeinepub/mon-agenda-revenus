import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AppointmentForm } from "../components/AppointmentForm";
import { ClientCardModal } from "../components/ClientCardModal";
import { ContextMenu } from "../components/ContextMenu";
import { useTranslation } from "../hooks/useTranslation";
import { useStore } from "../store/useStore";
import type { Appointment, Client } from "../types";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function calcRevenusFaitsEtPayes(appts: Appointment[]): number {
  return appts
    .filter((a) => a.fait && !a.annule && a.montantPaye > 0)
    .reduce((s, a) => s + a.montantPaye, 0);
}

export function CalendrierSemaine() {
  const { t, tArr } = useTranslation();
  const {
    appointments,
    clients,
    updateAppointment,
    deleteAppointment,
    deleteFutureAppointments,
    setPaymentDate,
  } = useStore();

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    appt: Appointment;
  } | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const days = tArr("calendar.jours_court");
  const today = toISO(new Date());

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const weekAppts = useMemo(() => {
    const start = toISO(weekDates[0]);
    const end = toISO(weekDates[6]);
    return appointments
      .filter((a) => a.date >= start && a.date <= end)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.heureDebut.localeCompare(b.heureDebut),
      );
  }, [appointments, weekDates]);

  // Summary calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthAppts = useMemo(
    () =>
      appointments.filter((a) => {
        const d = new Date(a.date);
        return (
          d.getFullYear() === currentYear &&
          d.getMonth() === weekStart.getMonth()
        );
      }),
    [appointments, currentYear, weekStart],
  );

  const yearAppts = useMemo(
    () =>
      appointments.filter((a) => {
        const d = new Date(a.date);
        return d.getFullYear() === currentYear;
      }),
    [appointments, currentYear],
  );

  const allPastMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      if (m >= currentMonth) return 0;
      const mAppts = appointments.filter((a) => {
        const d = new Date(a.date);
        return d.getFullYear() === currentYear && d.getMonth() === m;
      });
      return calcRevenusFaitsEtPayes(mAppts);
    }).filter((v) => v > 0);
  }, [appointments, currentYear, currentMonth]);

  const totalAnneeRevenus = calcRevenusFaitsEtPayes(yearAppts);
  const totalAnneeRdvFaits = yearAppts
    .filter((a) => a.fait && !a.annule)
    .reduce((s, a) => s + a.montantDu, 0);
  const annualDu = Math.max(0, totalAnneeRdvFaits - totalAnneeRevenus);

  function getClient(ref: string) {
    return clients.find((c) => c.reference === ref);
  }

  function getDisplayName(appt: Appointment) {
    const client = getClient(appt.clientRef);
    if (client?.prenom)
      return `${client.prenom}, ${client.nom || ""}`.trim().replace(/,$/, "");
    return appt.clientNom || appt.clientRef;
  }

  function handleContextMenu(e: React.MouseEvent, appt: Appointment) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, appt });
  }

  const handleViewClient = useCallback(
    (appt: Appointment) => {
      const c = clients.find((cl) => cl.reference === appt.clientRef);
      if (c) setSelectedClient(c);
    },
    [clients],
  );

  const getApptDayOfWeek = (appt: Appointment) => {
    const d = new Date(appt.date);
    const jsDay = d.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  };

  // Dark mode: bg-primary/10 stays light in dark → use dark:bg-muted
  const thCls =
    "border border-border px-1 py-0.5 text-center text-xs font-semibold bg-primary/10 dark:bg-muted text-foreground";
  // All td cells need explicit text-foreground for dark mode
  const tdCls = "border-r border-border px-1 py-0 text-foreground";

  function NoteCell({ appt }: { appt: Appointment }) {
    const [localNote, setLocalNote] = useState(appt.note);
    return (
      <input
        type="text"
        value={localNote}
        onChange={(e) => setLocalNote(e.target.value)}
        onBlur={() => {
          if (localNote !== appt.note)
            updateAppointment(appt.id, { note: localNote });
        }}
        className="w-full bg-transparent text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-0.5"
        style={{ fontFamily: "Verdana", minWidth: 0 }}
      />
    );
  }

  function PayeCell({ appt }: { appt: Appointment }) {
    const [localVal, setLocalVal] = useState(String(appt.montantPaye));
    const [focused, setFocused] = useState(false);
    return (
      <input
        type="text"
        inputMode="decimal"
        value={focused ? localVal : appt.montantPaye.toFixed(2)}
        onChange={(e) => setLocalVal(e.target.value)}
        onFocus={() => {
          setFocused(true);
          setLocalVal(String(appt.montantPaye));
        }}
        onBlur={() => {
          setFocused(false);
          const num = Number.parseFloat(localVal);
          if (!Number.isNaN(num) && num !== appt.montantPaye)
            updateAppointment(appt.id, { montantPaye: num });
        }}
        className="w-full bg-transparent text-foreground text-xs input-no-spinner focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-0.5 text-right"
        style={{ fontFamily: "Verdana", minWidth: 0 }}
      />
    );
  }

  function DateCell({ appt }: { appt: Appointment }) {
    const [localDate, setLocalDate] = useState(appt.paymentDate ?? "");
    return (
      <input
        type="text"
        value={localDate}
        onChange={(e) => setLocalDate(e.target.value)}
        onBlur={() => {
          if (localDate !== (appt.paymentDate ?? ""))
            setPaymentDate(appt.id, localDate);
        }}
        className="w-full bg-transparent text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-0.5"
        style={{ fontFamily: "Verdana", minWidth: 0, width: 44 }}
        placeholder="jj/mm"
      />
    );
  }

  return (
    <div
      className="p-3 space-y-4"
      style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
    >
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setWeekStart((w) => {
              const d = new Date(w);
              d.setDate(d.getDate() - 7);
              return d;
            })
          }
          className="p-1 hover:bg-muted rounded border border-border text-foreground"
          aria-label={t("calendar.navigation_precedent")}
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {t("calendar.semaine")} {toISO(weekDates[0])} — {toISO(weekDates[6])}
        </span>
        <button
          type="button"
          onClick={() => setWeekStart(getWeekStart(new Date()))}
          className="px-2 py-0.5 text-xs border border-border rounded hover:bg-muted text-foreground"
        >
          {t("dashboard.btn_aujourd_hui")}
        </button>
        <button
          type="button"
          onClick={() =>
            setWeekStart((w) => {
              const d = new Date(w);
              d.setDate(d.getDate() + 7);
              return d;
            })
          }
          className="p-1 hover:bg-muted rounded border border-border text-foreground"
          aria-label={t("calendar.navigation_suivant")}
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="ml-auto px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          + {t("nav.nouveau_rdv")}
        </button>
      </div>

      {/* Weekly grid — 7 day sections */}
      <div className="space-y-3">
        {weekDates.map((dayDate, dayIdx) => {
          const dateStr = toISO(dayDate);
          const isToday = dateStr === today;
          const dayAppts = weekAppts.filter((a) => a.date === dateStr);
          return (
            <div
              key={dateStr}
              className={`bg-card border border-border rounded overflow-hidden ${isToday ? "ring-2 ring-yellow-400" : ""}`}
            >
              {/* Day header */}
              <div
                className={`px-3 py-1 border-b border-border text-xs font-bold text-foreground ${isToday ? "bg-yellow-100 dark:bg-yellow-900/40" : "bg-muted/40 dark:bg-muted/30"}`}
              >
                {days[dayIdx]} {dayDate.getDate()}/{dayDate.getMonth() + 1}/
                {dayDate.getFullYear()}
              </div>
              <div className="overflow-x-auto">
                <table
                  className="w-full border-collapse bg-card"
                  style={{
                    tableLayout: "fixed",
                    fontFamily: "Verdana",
                    fontSize: 10,
                  }}
                >
                  <colgroup>
                    <col style={{ width: 44 }} />
                    <col style={{ width: 88 }} />
                    <col style={{ width: 60 }} />
                    <col style={{ width: 22 }} />
                    <col style={{ width: 22 }} />
                    <col style={{ width: 44 }} />
                    <col style={{ width: 44 }} />
                    <col style={{ width: 44 }} />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={thCls}>{t("calendar.col_heure")}</th>
                      <th className={thCls}>{t("calendar.col_nom")}</th>
                      <th className={thCls}>{t("calendar.col_ref")}</th>
                      <th className={thCls}>{t("calendar.col_fait")}</th>
                      <th className={thCls}>{t("calendar.col_annule")}</th>
                      <th className={`${thCls} text-right`}>
                        {t("calendar.col_du")}
                      </th>
                      <th className={`${thCls} text-right`}>
                        {t("calendar.col_paye")}
                      </th>
                      <th className={thCls}>{t("calendar.col_date_pmt")}</th>
                      <th className={`${thCls} text-left`}>
                        {t("calendar.col_note")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayAppts.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-2 py-1 text-xs text-muted-foreground text-center"
                          style={{ height: 14 }}
                        />
                      </tr>
                    )}
                    {dayAppts.map((appt, i) => {
                      const du = appt.annule ? 0 : appt.montantDu;
                      return (
                        <tr
                          key={appt.id}
                          className={
                            i % 2 === 0 ? "bg-background" : "bg-muted/20"
                          }
                          style={{ height: 14 }}
                        >
                          <td
                            className={`${tdCls} text-foreground`}
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {appt.heureDebut}
                          </td>
                          <td
                            className={`${tdCls} cursor-pointer hover:text-primary`}
                          >
                            <button
                              type="button"
                              className="block truncate w-full text-left text-xs text-foreground"
                              onContextMenu={(e) => handleContextMenu(e, appt)}
                              onClick={(e) => handleContextMenu(e, appt)}
                            >
                              {getDisplayName(appt)}
                            </button>
                          </td>
                          <td className={`${tdCls} text-foreground`}>
                            {appt.clientRef}
                          </td>
                          <td className={`${tdCls} text-center`}>
                            <input
                              type="checkbox"
                              checked={appt.fait}
                              onChange={(e) =>
                                updateAppointment(appt.id, {
                                  fait: e.target.checked,
                                  statut: e.target.checked
                                    ? "fait"
                                    : "non-traite",
                                })
                              }
                              className="w-3 h-3"
                            />
                          </td>
                          <td className={`${tdCls} text-center`}>
                            <input
                              type="checkbox"
                              checked={appt.annule}
                              onChange={(e) => {
                                const isAnnule = e.target.checked;
                                updateAppointment(appt.id, {
                                  annule: isAnnule,
                                  statut: isAnnule ? "annule" : "non-traite",
                                  montantDu: isAnnule ? 0 : appt.montantDu,
                                });
                              }}
                              className="w-3 h-3"
                            />
                          </td>
                          <td className={`${tdCls} text-right text-foreground`}>
                            {du.toFixed(2)}
                          </td>
                          <td className={tdCls} style={{ width: 44 }}>
                            <PayeCell appt={appt} />
                          </td>
                          <td className={tdCls} style={{ width: 44 }}>
                            <DateCell appt={appt} />
                          </td>
                          <td className="px-1 py-0">
                            <NoteCell appt={appt} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary box — dark mode needs bg-card + text-foreground */}
      <div className="bg-card border border-border rounded p-3">
        <h3 className="font-bold text-xs text-foreground mb-2">
          {t("calendar.resume")}
        </h3>
        <table className="text-xs" style={{ fontFamily: "Verdana" }}>
          <tbody>
            <tr>
              <td className="pr-4 text-muted-foreground text-right">
                {t("calendar.total_semaine")} :
              </td>
              <td className="font-semibold text-foreground">
                {calcRevenusFaitsEtPayes(weekAppts).toFixed(2)} €
              </td>
            </tr>
            <tr>
              <td className="pr-4 text-muted-foreground text-right">
                {t("calendar.total_mensuel")} :
              </td>
              <td className="font-semibold text-foreground">
                {calcRevenusFaitsEtPayes(monthAppts).toFixed(2)} €
              </td>
            </tr>
            <tr>
              <td className="pr-4 text-muted-foreground text-right">
                {t("calendar.total_annee")} :
              </td>
              <td className="font-semibold text-foreground">
                {totalAnneeRevenus.toFixed(2)} € — {t("calendar.fait_paye")}
              </td>
            </tr>
            <tr>
              <td className="pr-4 text-muted-foreground text-right">
                {t("calendar.du_label")} :
              </td>
              <td className="font-semibold text-destructive">
                {annualDu.toFixed(2)} €
              </td>
            </tr>
          </tbody>
        </table>
        <div className="mt-2 text-xs text-muted-foreground">
          {t("calendar.revenu_moy") || ""}
          {allPastMonths.length > 0 ? ` (${allPastMonths.length} mois)` : ""}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: t("calendar.menu_modifier_rdv"),
              onClick: () => {
                setEditAppt(contextMenu.appt);
                setContextMenu(null);
              },
            },
            {
              label: t("calendar.menu_modifier_futurs"),
              onClick: () => {
                setEditAppt(contextMenu.appt);
                setContextMenu(null);
              },
            },
            {
              label: t("calendar.menu_supprimer_rdv"),
              danger: true,
              onClick: () => {
                deleteAppointment(contextMenu.appt.id);
                setContextMenu(null);
              },
            },
            {
              label: t("calendar.menu_supprimer_futurs"),
              danger: true,
              onClick: () => {
                const dayOfWeek = getApptDayOfWeek(contextMenu.appt);
                if (window.confirm(t("common.confirmer"))) {
                  deleteFutureAppointments(
                    contextMenu.appt.clientRef,
                    contextMenu.appt.date,
                    dayOfWeek,
                  );
                }
                setContextMenu(null);
              },
            },
            {
              label: t("calendar.menu_fiche_client"),
              onClick: () => {
                handleViewClient(contextMenu.appt);
                setContextMenu(null);
              },
            },
          ]}
        />
      )}

      {selectedClient && (
        <ClientCardModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
      {editAppt && (
        <AppointmentForm
          editAppointment={editAppt}
          onClose={() => setEditAppt(null)}
        />
      )}
      {showNewForm && <AppointmentForm onClose={() => setShowNewForm(false)} />}
    </div>
  );
}
