import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { AppointmentForm } from "../components/AppointmentForm";
import { ClientCardModal } from "../components/ClientCardModal";
import { ContextMenu } from "../components/ContextMenu";
import { useTranslation } from "../hooks/useTranslation";
import { useStore } from "../store/useStore";
import type { Appointment, Client } from "../types";

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function generateTimeSlots(startHour: string, endHour: string): string[] {
  const [sh, sm] = startHour.split(":").map(Number);
  const [eh, em] = endHour.split(":").map(Number);
  const slots: string[] = [];
  let totalMins = (sh ?? 7) * 60 + (sm ?? 0);
  const endMins = (eh ?? 22) * 60 + (em ?? 0);
  while (totalMins <= endMins) {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    totalMins += 15;
  }
  return slots;
}

export function CalendrierJournalier() {
  const { t, tArr } = useTranslation();
  const {
    appointments,
    clients,
    settings,
    updateAppointment,
    updateSettings,
    deleteAppointment,
    deleteFutureAppointments,
    setPaymentDate,
  } = useStore();

  const [currentDate, setCurrentDate] = useState(() => toISO(new Date()));
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    appt: Appointment;
  } | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const days = tArr("calendar.jours");
  const months = tArr("calendar.months");
  const today = toISO(new Date());

  const dayDate = new Date(currentDate);
  const jsDay = dayDate.getDay();
  const dayIdx = jsDay === 0 ? 6 : jsDay - 1;

  const timeSlots = useMemo(
    () => generateTimeSlots(settings.dailyStartHour, settings.dailyEndHour),
    [settings.dailyStartHour, settings.dailyEndHour],
  );

  const dayAppts = useMemo(
    () =>
      appointments
        .filter((a) => a.date === currentDate)
        .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut)),
    [appointments, currentDate],
  );

  function getDisplayName(appt: Appointment) {
    const client = clients.find((c) => c.reference === appt.clientRef);
    if (client?.prenom)
      return `${client.prenom}, ${client.nom || ""}`.replace(/,\s*$/, "");
    return appt.clientNom || appt.clientRef;
  }

  function isInSlot(appt: Appointment, slot: string): boolean {
    return slot >= appt.heureDebut && slot < appt.heureFin;
  }

  function handleContextMenu(e: React.MouseEvent, appt: Appointment) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, appt });
  }

  function getApptDayOfWeek(appt: Appointment): number {
    const d = new Date(appt.date);
    const jsD = d.getDay();
    return jsD === 0 ? 6 : jsD - 1;
  }

  function prevDay() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(toISO(d));
  }

  function nextDay() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(toISO(d));
  }

  const thCls =
    "border border-border px-1 py-0.5 text-center text-xs font-semibold bg-primary/10 dark:bg-muted text-foreground";

  function NoteCell({ appt }: { appt: Appointment }) {
    const [local, setLocal] = useState(appt.note);
    return (
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== appt.note) updateAppointment(appt.id, { note: local });
        }}
        className="w-full bg-transparent text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-0.5"
        style={{ fontFamily: "Verdana", minWidth: 0 }}
      />
    );
  }

  function PayeCell({ appt }: { appt: Appointment }) {
    const [local, setLocal] = useState(String(appt.montantPaye));
    const [focused, setFocused] = useState(false);
    return (
      <input
        type="text"
        inputMode="decimal"
        value={focused ? local : appt.montantPaye.toFixed(2)}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => {
          setFocused(true);
          setLocal(String(appt.montantPaye));
        }}
        onBlur={() => {
          setFocused(false);
          const num = Number.parseFloat(local);
          if (!Number.isNaN(num) && num !== appt.montantPaye)
            updateAppointment(appt.id, { montantPaye: num });
        }}
        className="w-full bg-transparent text-foreground text-xs input-no-spinner focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-0.5 text-right"
        style={{ fontFamily: "Verdana", minWidth: 0 }}
      />
    );
  }

  function DateCell({ appt }: { appt: Appointment }) {
    const [local, setLocal] = useState(appt.paymentDate ?? "");
    return (
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== (appt.paymentDate ?? ""))
            setPaymentDate(appt.id, local);
        }}
        className="w-full bg-transparent text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-0.5"
        style={{ fontFamily: "Verdana", minWidth: 0 }}
        placeholder="jj/mm"
      />
    );
  }

  return (
    <div
      className="p-3 space-y-3"
      style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
    >
      {/* Navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={prevDay}
          className="p-1 hover:bg-muted rounded border border-border text-foreground"
          aria-label={t("calendar.navigation_precedent")}
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {days[dayIdx]} {dayDate.getDate()} {months[dayDate.getMonth()]}{" "}
          {dayDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setCurrentDate(today)}
          className="px-2 py-0.5 text-xs border border-border rounded hover:bg-muted text-foreground"
        >
          {t("dashboard.btn_aujourd_hui")}
        </button>
        <button
          type="button"
          onClick={nextDay}
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

      {/* Start/End time */}
      <div className="flex items-center gap-4 text-xs">
        <label htmlFor="jrnl-start" className="text-muted-foreground">
          {t("calendar.debut_journee")}:
        </label>
        <input
          id="jrnl-start"
          type="time"
          value={settings.dailyStartHour}
          onChange={(e) => updateSettings({ dailyStartHour: e.target.value })}
          className="border border-input rounded px-2 py-0.5 text-xs bg-background text-foreground dark:bg-card dark:text-foreground dark:border-border"
        />
        <label htmlFor="jrnl-end" className="text-muted-foreground">
          {t("calendar.fin_journee")}:
        </label>
        <input
          id="jrnl-end"
          type="time"
          value={settings.dailyEndHour}
          onChange={(e) => updateSettings({ dailyEndHour: e.target.value })}
          className="border border-input rounded px-2 py-0.5 text-xs bg-background text-foreground dark:bg-card dark:text-foreground dark:border-border"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse bg-card"
            style={{
              tableLayout: "fixed",
              fontFamily: "Verdana",
              fontSize: 12,
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
              {timeSlots.map((slot) => {
                const appt = dayAppts.find((a) => isInSlot(a, slot));
                const isApptStart = appt && appt.heureDebut === slot;
                const isApptRange = appt && isInSlot(appt, slot);
                const bgColor = isApptRange
                  ? appt.annule
                    ? "bg-pink-100 dark:bg-pink-900/30"
                    : appt.fait
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-blue-50 dark:bg-blue-900/20"
                  : "";
                const du = appt ? (appt.annule ? 0 : appt.montantDu) : 0;

                return (
                  <tr
                    key={slot}
                    className={`${bgColor} border-b border-border/30`}
                    style={{ height: 12 }}
                  >
                    <td
                      className="border-r border-border/30 px-1 text-xs text-muted-foreground"
                      style={{ whiteSpace: "nowrap", fontSize: 12 }}
                    >
                      {slot}
                    </td>
                    {isApptStart && appt ? (
                      <>
                        <td
                          className="border-r border-border/30 px-1 py-0 text-foreground"
                          style={{ fontSize: 12 }}
                        >
                          <button
                            type="button"
                            className="block truncate w-full text-left cursor-pointer hover:text-primary text-xs"
                            onClick={(e) => handleContextMenu(e, appt)}
                            onContextMenu={(e) => handleContextMenu(e, appt)}
                          >
                            {getDisplayName(appt)}
                            <span
                              className="block text-muted-foreground"
                              style={{ fontSize: 10 }}
                            >
                              {appt.clientRef} {appt.heureDebut}-{appt.heureFin}
                            </span>
                          </button>
                        </td>
                        <td className="border-r border-border/30 px-1 text-xs text-foreground">
                          {appt.clientRef}
                        </td>
                        <td className="border-r border-border/30 px-1 text-center">
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
                        <td className="border-r border-border/30 px-1 text-center">
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
                        <td className="border-r border-border/30 px-1 text-right text-xs text-foreground">
                          {du.toFixed(2)}
                        </td>
                        <td
                          className="border-r border-border/30 px-1"
                          style={{ width: 44 }}
                        >
                          <PayeCell appt={appt} />
                        </td>
                        <td
                          className="border-r border-border/30 px-1"
                          style={{ width: 44 }}
                        >
                          <DateCell appt={appt} />
                        </td>
                        <td className="px-1">
                          <NoteCell appt={appt} />
                        </td>
                      </>
                    ) : isApptRange && appt ? (
                      <td
                        colSpan={8}
                        className="px-1 text-xs text-muted-foreground"
                      />
                    ) : (
                      <td colSpan={8} />
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                const dow = getApptDayOfWeek(contextMenu.appt);
                if (window.confirm(t("common.confirmer")))
                  deleteFutureAppointments(
                    contextMenu.appt.clientRef,
                    contextMenu.appt.date,
                    dow,
                  );
                setContextMenu(null);
              },
            },
            {
              label: t("calendar.menu_fiche_client"),
              onClick: () => {
                const c = clients.find(
                  (cl) => cl.reference === contextMenu.appt.clientRef,
                );
                if (c) setSelectedClient(c);
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
      {showNewForm && (
        <AppointmentForm
          onClose={() => setShowNewForm(false)}
          defaultDate={currentDate}
        />
      )}
    </div>
  );
}
