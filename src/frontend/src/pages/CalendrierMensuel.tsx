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

export function CalendrierMensuel() {
  const { t, tArr } = useTranslation();
  const { appointments, clients, deleteAppointment, deleteFutureAppointments } =
    useStore();

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    appt: Appointment;
  } | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDefaultDate, setNewDefaultDate] = useState("");

  const monthNames = tArr("calendar.months");
  const daysShort = tArr("calendar.jours_court");
  const today = toISO(new Date());

  const calendarDaysWithKeys = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const jsFirstDay = firstDay.getDay();
    const startOffset = jsFirstDay === 0 ? 6 : jsFirstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        return {
          key: `empty-${year}-${month}-wk${Math.floor(i / 7)}-${i % 7}`,
          dayNum: null,
          iso: null,
        };
      }
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      return { key: iso, dayNum, iso };
    });
  }, [year, month]);

  const monthAppts = useMemo(() => {
    return appointments.filter((a) => {
      const d = new Date(a.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [appointments, year, month]);

  function getApptsByDate(iso: string) {
    return monthAppts.filter((a) => a.date === iso);
  }

  function getDisplayName(appt: Appointment) {
    const client = clients.find((c) => c.reference === appt.clientRef);
    if (client?.prenom)
      return `${client.prenom}, ${client.nom || ""}`.replace(/,\s*$/, "");
    return appt.clientNom || appt.clientRef;
  }

  function getApptColor(appt: Appointment) {
    if (appt.annule) return "text-pink-600 dark:text-pink-400";
    if (appt.fait) return "text-green-700 dark:text-green-400";
    return "text-muted-foreground";
  }

  function handleContextMenu(e: React.MouseEvent, appt: Appointment) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, appt });
  }

  function getApptDayOfWeek(appt: Appointment): number {
    const d = new Date(appt.date);
    const jsD = d.getDay();
    return jsD === 0 ? 6 : jsD - 1;
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  return (
    <div
      className="p-3 space-y-3"
      style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
    >
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 hover:bg-muted rounded border border-border"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {monthNames[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => {
            setMonth(new Date().getMonth());
            setYear(new Date().getFullYear());
          }}
          className="px-2 py-0.5 text-xs border border-border rounded hover:bg-muted"
        >
          {t("dashboard.btn_aujourd_hui")}
        </button>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 hover:bg-muted rounded border border-border"
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

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-green-700 dark:text-green-400">
          ● {t("calendar.legend_fait")}
        </span>
        <span className="text-pink-600 dark:text-pink-400">
          ● {t("calendar.legend_annule")}
        </span>
        <span className="text-muted-foreground">
          ● {t("calendar.legend_non_traite")}
        </span>
      </div>

      {/* Calendar grid */}
      <div
        className="bg-card border border-border rounded-lg overflow-hidden shadow-xs mx-auto"
        style={{ maxWidth: 700 }}
      >
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {daysShort.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-xs font-semibold text-foreground border-r border-border last:border-r-0 bg-primary/10"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid grid-cols-7">
          {calendarDaysWithKeys.map((cell) => {
            if (!cell.iso || !cell.dayNum) {
              return (
                <div
                  key={cell.key}
                  className="border-r border-b border-border bg-muted/20 last:border-r-0"
                  style={{ minHeight: 80, width: 87 }}
                />
              );
            }
            const { dayNum, iso } = cell;
            const isToday = iso === today;
            const dayAppts = getApptsByDate(iso);
            return (
              <div
                key={iso}
                className={`border-r border-b border-border last:border-r-0 relative ${isToday ? "bg-yellow-50 dark:bg-yellow-900/20" : "bg-card"}`}
                style={{ minHeight: 80, width: 87 }}
              >
                {/* Date number */}
                <div
                  className={`text-right px-1 py-0.5 text-xs font-semibold ${isToday ? "text-yellow-700 dark:text-yellow-400" : "text-muted-foreground"}`}
                >
                  {dayNum}
                </div>
                {/* Appointments */}
                <div className="px-0.5">
                  {dayAppts.map((appt) => (
                    <button
                      key={appt.id}
                      type="button"
                      onClick={(e) => handleContextMenu(e, appt)}
                      onContextMenu={(e) => handleContextMenu(e, appt)}
                      className={`block w-full text-left truncate text-xs hover:underline cursor-pointer ${getApptColor(appt)}`}
                      style={{
                        fontSize: 10,
                        lineHeight: "14px",
                        fontFamily: "Verdana",
                      }}
                    >
                      {getDisplayName(appt)}
                    </button>
                  ))}
                </div>
                {/* Click to add */}
                <button
                  type="button"
                  onClick={() => {
                    setNewDefaultDate(iso);
                    setShowNewForm(true);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label={`${t("nav.nouveau_rdv")} ${iso}`}
                />
              </div>
            );
          })}
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
          defaultDate={newDefaultDate}
        />
      )}
    </div>
  );
}
