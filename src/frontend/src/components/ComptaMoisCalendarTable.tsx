import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { RendezVous } from "../backend";
import {
  useGetAllAppointments,
  useUpdateAppointmentStatus,
  useUpdateMontantPaye,
} from "../hooks/useQueries";
import AppointmentActionDialog from "./AppointmentActionDialog";

// Helper functions
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

const getWeekdayAbbreviation = (date: Date): string => {
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return days[date.getDay()];
};

const isSameDay = (a: Date, b: Date): boolean => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

interface ComptaMoisCalendarTableProps {
  /** Controlled: current year (1-based) */
  year: number;
  /** Controlled: current month (1-based) */
  month: number;
  /** Called when the user navigates to a different month */
  onMonthChange: (year: number, month: number) => void;
  /** @deprecated use year/month/onMonthChange instead */
  initialMonth?: Date;
}

export default function ComptaMoisCalendarTable({
  year,
  month,
  onMonthChange,
  initialMonth: _initialMonth,
}: ComptaMoisCalendarTableProps) {
  const {
    data: appointments = [],
    isLoading,
    refetch: refetchAppointments,
  } = useGetAllAppointments();
  const updateStatusMutation = useUpdateAppointmentStatus();
  const updateMontantPayeMutation = useUpdateMontantPaye();

  const [editingMontantPaye, setEditingMontantPaye] = useState<{
    id: bigint;
    value: string;
  } | null>(null);
  const [editingCommentaire, setEditingCommentaire] = useState<{
    id: bigint;
    value: string;
  } | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<RendezVous | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [localMontantPayeUpdates, setLocalMontantPayeUpdates] = useState<
    Map<string, bigint>
  >(new Map());
  const [localCommentaireUpdates, setLocalCommentaireUpdates] = useState<
    Map<string, string>
  >(new Map());

  // Today's date for column highlighting
  const today = useMemo(() => new Date(), []);

  // Derive the current month Date from controlled props
  const currentMonth = useMemo(() => {
    return new Date(year, month - 1, 1);
  }, [year, month]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 7; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      if (hour < 23) {
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
    }
    return slots;
  }, []);

  const monthDays = useMemo(() => {
    const y = currentMonth.getFullYear();
    const monthIndex = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(y, monthIndex);

    const days: Date[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(y, monthIndex, i));
    }
    return days;
  }, [currentMonth]);

  useEffect(() => {
    setLocalMontantPayeUpdates(new Map());
    setLocalCommentaireUpdates(new Map());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isTimeSlotInAppointmentRange = (
    timeSlot: string,
    appointment: RendezVous,
  ): boolean => {
    const slotMinutes = timeToMinutes(timeSlot);
    const startMinutes = timeToMinutes(appointment.heureDebut);
    const endMinutes = timeToMinutes(appointment.heureFin);

    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  };

  const getAppointmentStartingAtTimeSlot = (
    date: Date,
    timeSlot: string,
  ): RendezVous | null => {
    return (
      appointments.find((apt) => {
        const aptDate = new Date(Number(apt.dateHeure) / 1000000);
        if (aptDate.toDateString() !== date.toDateString()) {
          return false;
        }
        return apt.heureDebut === timeSlot;
      }) || null
    );
  };

  const _getAppointmentForDay = (date: Date): RendezVous[] => {
    return appointments.filter((apt) => {
      const aptDate = new Date(Number(apt.dateHeure) / 1000000);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  const formatMonthYear = () => {
    return currentMonth.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
  };

  const getDisplayedMontantPaye = (appointment: RendezVous): string => {
    if (editingMontantPaye?.id === appointment.id) {
      return editingMontantPaye.value;
    }
    const localUpdate = localMontantPayeUpdates.get(appointment.id.toString());
    if (localUpdate !== undefined) {
      return Number(localUpdate).toString();
    }
    return Number(appointment.montantPaye).toString();
  };

  const getDisplayedCommentaire = (appointment: RendezVous): string => {
    if (editingCommentaire?.id === appointment.id) {
      return editingCommentaire.value;
    }
    const localUpdate = localCommentaireUpdates.get(appointment.id.toString());
    if (localUpdate !== undefined) {
      return localUpdate;
    }
    return appointment.commentaireManuel || "";
  };

  // Navigation handlers — call parent callback instead of local state
  const goToPreviousMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12);
    } else {
      onMonthChange(year, month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      onMonthChange(year + 1, 1);
    } else {
      onMonthChange(year, month + 1);
    }
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    onMonthChange(now.getFullYear(), now.getMonth() + 1);
  };

  const handleToggleFait = async (
    appointment: RendezVous,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    e.stopPropagation();
    try {
      await updateStatusMutation.mutateAsync({
        id: appointment.id,
        fait: !appointment.fait,
        annule: appointment.annule ? false : null,
      });
      toast.success("Statut mis à jour");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    }
  };

  const handleToggleAnnule = async (
    appointment: RendezVous,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    e.stopPropagation();
    try {
      await updateStatusMutation.mutateAsync({
        id: appointment.id,
        annule: !appointment.annule,
        fait: appointment.fait ? false : null,
      });
      toast.success("Statut mis à jour");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
      console.error(error);
    }
  };

  const handleMontantPayeClick = (
    appointment: RendezVous,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const currentValue =
      localMontantPayeUpdates.get(appointment.id.toString()) ??
      appointment.montantPaye;
    setEditingMontantPaye({
      id: appointment.id,
      value: Number(currentValue).toString(),
    });
  };

  const handleMontantPayeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editingMontantPaye) {
      setEditingMontantPaye({
        ...editingMontantPaye,
        value: e.target.value,
      });
    }
  };

  const handleMontantPayeBlur = async (appointment: RendezVous) => {
    if (!editingMontantPaye) return;

    const inputValue = editingMontantPaye.value.trim();

    if (inputValue === "") {
      setEditingMontantPaye(null);
      return;
    }

    try {
      const parsedValue = Number.parseFloat(inputValue);
      if (Number.isNaN(parsedValue) || parsedValue < 0) {
        toast.error("Veuillez entrer un montant valide");
        setEditingMontantPaye(null);
        return;
      }

      const newMontantPaye = BigInt(Math.round(parsedValue));

      const newLocalUpdates = new Map(localMontantPayeUpdates);
      newLocalUpdates.set(appointment.id.toString(), newMontantPaye);
      setLocalMontantPayeUpdates(newLocalUpdates);

      setEditingMontantPaye(null);

      await updateMontantPayeMutation.mutateAsync({
        id: appointment.id,
        montantPaye: newMontantPaye,
        referenceClient: appointment.referenceClient,
      });

      toast.success("Montant payé mis à jour avec ajustement des crédits");

      await refetchAppointments();
    } catch (error) {
      toast.error("Erreur lors de la mise à jour du montant payé");
      console.error(error);
      setEditingMontantPaye(null);
      const newLocalUpdates = new Map(localMontantPayeUpdates);
      newLocalUpdates.delete(appointment.id.toString());
      setLocalMontantPayeUpdates(newLocalUpdates);
    }
  };

  const handleCommentaireClick = (
    appointment: RendezVous,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const currentValue =
      localCommentaireUpdates.get(appointment.id.toString()) ??
      appointment.commentaireManuel ??
      "";
    setEditingCommentaire({
      id: appointment.id,
      value: currentValue,
    });
  };

  const handleCommentaireChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editingCommentaire) {
      setEditingCommentaire({
        ...editingCommentaire,
        value: e.target.value,
      });
    }
  };

  const handleCommentaireBlur = async (appointment: RendezVous) => {
    if (!editingCommentaire) return;

    const inputValue = editingCommentaire.value.trim();

    const newLocalUpdates = new Map(localCommentaireUpdates);
    newLocalUpdates.set(appointment.id.toString(), inputValue);
    setLocalCommentaireUpdates(newLocalUpdates);

    setEditingCommentaire(null);

    try {
      await updateStatusMutation.mutateAsync({
        id: appointment.id,
        commentaireManuel: inputValue,
      });

      toast.success("Commentaire mis à jour");

      await refetchAppointments();
    } catch (error) {
      toast.error("Erreur lors de la mise à jour du commentaire");
      console.error(error);
      const newLocalUpdates2 = new Map(localCommentaireUpdates);
      newLocalUpdates2.delete(appointment.id.toString());
      setLocalCommentaireUpdates(newLocalUpdates2);
    }
  };

  const handleAppointmentClick = (appointment: RendezVous) => {
    setSelectedAppointment(appointment);
    setShowActionDialog(true);
  };

  const handleCloseActionDialog = () => {
    setShowActionDialog(false);
    setSelectedAppointment(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="table-data text-muted-foreground">
          Chargement du calendrier...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-4">
          <h2 className="frame-title">{formatMonthYear()}</h2>
          <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
            Aujourd'hui
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="compta-mois-table w-full border-collapse">
          <thead>
            {/* Day of week row */}
            <tr>
              <th className="compta-mois-hour-header table-header border bg-muted/50" />
              {monthDays.map((date) => {
                const isSunday = date.getDay() === 0;
                const isToday = isSameDay(date, today);
                const dayKey = `wd-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                return (
                  <th
                    key={dayKey}
                    className={`compta-mois-day-header table-header border text-center ${
                      isToday
                        ? "compta-mois-today-header"
                        : isSunday
                          ? "compta-mois-sunday-header"
                          : "bg-muted/50"
                    }`}
                  >
                    {getWeekdayAbbreviation(date)}
                  </th>
                );
              })}
            </tr>
            {/* Day number row */}
            <tr>
              <th className="compta-mois-hour-header table-header border bg-muted/50" />
              {monthDays.map((date) => {
                const isSunday = date.getDay() === 0;
                const isToday = isSameDay(date, today);
                const dayKey = `dn-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                return (
                  <th
                    key={dayKey}
                    className={`compta-mois-day-header table-header border text-center ${
                      isToday
                        ? "compta-mois-today-header"
                        : isSunday
                          ? "compta-mois-sunday-header"
                          : "bg-muted/50"
                    }`}
                  >
                    {date.getDate()}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((timeSlot) => {
              const isHourMark = timeSlot.endsWith(":00");
              const isHalfHourMark = timeSlot.endsWith(":30");
              return (
                <tr
                  key={timeSlot}
                  className={`compta-mois-time-row ${
                    isHourMark
                      ? "compta-mois-hour-separator"
                      : isHalfHourMark
                        ? "compta-mois-halfhour-separator"
                        : ""
                  }`}
                >
                  {/* Hour label cell: pale pink background only for full hours */}
                  <td
                    className={`compta-mois-hour-cell table-data border ${
                      isHourMark ? "compta-mois-hour-label-cell" : "bg-muted/30"
                    }`}
                  >
                    {isHourMark ? timeSlot : ""}
                  </td>
                  {monthDays.map((date) => {
                    const appointment = getAppointmentStartingAtTimeSlot(
                      date,
                      timeSlot,
                    );
                    const isSunday = date.getDay() === 0;
                    const isToday = isSameDay(date, today);
                    const cellKey = `${timeSlot}-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

                    if (appointment) {
                      const rowSpan = Math.ceil(
                        (timeToMinutes(appointment.heureFin) -
                          timeToMinutes(appointment.heureDebut)) /
                          30,
                      );

                      let bgColor = "bg-blue-50";
                      if (appointment.annule) {
                        bgColor = "bg-red-100";
                      } else if (appointment.fait) {
                        bgColor = "bg-green-100";
                      }

                      return (
                        <td
                          key={cellKey}
                          rowSpan={rowSpan}
                          className={`compta-mois-day-cell table-data border ${bgColor} ${
                            isSunday ? "compta-mois-sunday-appointment" : ""
                          } ${isToday ? "compta-mois-today-appointment" : ""} cursor-pointer hover:opacity-80`}
                          onClick={() => handleAppointmentClick(appointment)}
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            handleAppointmentClick(appointment)
                          }
                        >
                          <div className="flex flex-col gap-0.5 p-0.5">
                            <div className="table-data font-semibold">
                              {appointment.nomClient}
                            </div>
                            {appointment.referenceClient && (
                              <div
                                className="table-data text-muted-foreground"
                                style={{ fontSize: "8px" }}
                              >
                                {appointment.referenceClient}
                              </div>
                            )}
                            <div className="table-data text-muted-foreground">
                              {appointment.heureDebut} - {appointment.heureFin}
                            </div>
                            <div className="table-data">
                              {appointment.service}
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={appointment.fait}
                                onChange={(e) =>
                                  handleToggleFait(appointment, e)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4"
                              />
                              <span className="table-data">Fait</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={appointment.annule}
                                onChange={(e) =>
                                  handleToggleAnnule(appointment, e)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-3 h-3"
                              />
                              <span className="table-data">Annulé</span>
                            </div>
                            <div className="table-data">
                              Dû: {Number(appointment.montantDu)}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="table-data">Payé:</span>
                              {editingMontantPaye?.id === appointment.id ? (
                                <input
                                  type="text"
                                  value={editingMontantPaye.value}
                                  onChange={handleMontantPayeChange}
                                  onBlur={() =>
                                    handleMontantPayeBlur(appointment)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="table-data w-20 px-1 py-0.5 border rounded"
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="table-data cursor-pointer hover:underline bg-white border border-gray-300 rounded px-2 py-0.5 min-w-[4rem] text-left"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMontantPayeClick(appointment, e);
                                  }}
                                >
                                  {getDisplayedMontantPaye(appointment)}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="table-data">Note:</span>
                              {editingCommentaire?.id === appointment.id ? (
                                <input
                                  type="text"
                                  value={editingCommentaire.value}
                                  onChange={handleCommentaireChange}
                                  onBlur={() =>
                                    handleCommentaireBlur(appointment)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="table-data w-20 px-1 border rounded"
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="table-data cursor-pointer hover:underline bg-transparent border-0 p-0 m-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCommentaireClick(appointment, e);
                                  }}
                                >
                                  {getDisplayedCommentaire(appointment) || "—"}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    }

                    // Check if this slot is covered by a spanning appointment
                    const coveringAppointment = appointments.find((apt) => {
                      const aptDate = new Date(Number(apt.dateHeure) / 1000000);
                      if (aptDate.toDateString() !== date.toDateString())
                        return false;
                      return (
                        isTimeSlotInAppointmentRange(timeSlot, apt) &&
                        apt.heureDebut !== timeSlot
                      );
                    });

                    if (coveringAppointment) {
                      return null;
                    }

                    return (
                      <td
                        key={cellKey}
                        className={`compta-mois-day-cell border ${
                          isToday
                            ? "compta-mois-today-empty"
                            : isSunday
                              ? "compta-mois-sunday-empty"
                              : ""
                        }`}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Appointment Action Dialog */}
      {selectedAppointment && (
        <AppointmentActionDialog
          appointment={selectedAppointment}
          open={showActionDialog}
          onClose={handleCloseActionDialog}
        />
      )}
    </div>
  );
}
