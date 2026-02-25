import { useState, useMemo, useEffect } from 'react';
import { useGetAllAppointments, useUpdateAppointmentStatus, useUpdateMontantPaye } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RendezVous } from '../backend';
import { toast } from 'sonner';
import AppointmentActionDialog from './AppointmentActionDialog';

// Helper functions
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const getWeekdayAbbreviation = (date: Date): string => {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return days[date.getDay()];
};

interface ComptaMoisCalendarTableProps {
  initialMonth?: Date;
}

export default function ComptaMoisCalendarTable({ initialMonth }: ComptaMoisCalendarTableProps) {
  const { data: appointments = [], isLoading, refetch: refetchAppointments } = useGetAllAppointments();
  const updateStatusMutation = useUpdateAppointmentStatus();
  const updateMontantPayeMutation = useUpdateMontantPaye();
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (initialMonth) return initialMonth;
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [editingMontantPaye, setEditingMontantPaye] = useState<{ id: bigint; value: string } | null>(null);
  const [editingCommentaire, setEditingCommentaire] = useState<{ id: bigint; value: string } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<RendezVous | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [localMontantPayeUpdates, setLocalMontantPayeUpdates] = useState<Map<string, bigint>>(new Map());
  const [localCommentaireUpdates, setLocalCommentaireUpdates] = useState<Map<string, string>>(new Map());

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 7; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 23) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const monthIndex = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, monthIndex);
    
    const days: Date[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, monthIndex, i));
    }
    return days;
  }, [currentMonth]);

  useEffect(() => {
    setLocalMontantPayeUpdates(new Map());
    setLocalCommentaireUpdates(new Map());
  }, [appointments]);

  const isTimeSlotInAppointmentRange = (timeSlot: string, appointment: RendezVous): boolean => {
    const slotMinutes = timeToMinutes(timeSlot);
    const startMinutes = timeToMinutes(appointment.heureDebut);
    const endMinutes = timeToMinutes(appointment.heureFin);
    
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  };

  const getAppointmentStartingAtTimeSlot = (date: Date, timeSlot: string): RendezVous | null => {
    return appointments.find((apt) => {
      const aptDate = new Date(Number(apt.dateHeure) / 1000000);
      if (aptDate.toDateString() !== date.toDateString()) {
        return false;
      }
      return apt.heureDebut === timeSlot;
    }) || null;
  };

  const getAppointmentForDay = (date: Date): RendezVous[] => {
    return appointments.filter((apt) => {
      const aptDate = new Date(Number(apt.dateHeure) / 1000000);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  const formatMonthYear = () => {
    return currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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
    return appointment.commentaireManuel || '';
  };

  const goToPreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const goToCurrentMonth = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const handleToggleFait = async (appointment: RendezVous, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    try {
      await updateStatusMutation.mutateAsync({
        id: appointment.id,
        fait: !appointment.fait,
        annule: appointment.annule ? false : null,
      });
      toast.success('Statut mis à jour');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    }
  };

  const handleToggleAnnule = async (appointment: RendezVous, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    try {
      await updateStatusMutation.mutateAsync({
        id: appointment.id,
        annule: !appointment.annule,
        fait: appointment.fait ? false : null,
      });
      toast.success('Statut mis à jour');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    }
  };

  const handleMontantPayeClick = (appointment: RendezVous, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentValue = localMontantPayeUpdates.get(appointment.id.toString()) ?? appointment.montantPaye;
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
    
    if (inputValue === '') {
      setEditingMontantPaye(null);
      return;
    }

    try {
      const parsedValue = parseFloat(inputValue);
      if (isNaN(parsedValue) || parsedValue < 0) {
        toast.error('Veuillez entrer un montant valide');
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
      
      toast.success('Montant payé mis à jour avec ajustement des crédits');
      
      await refetchAppointments();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du montant payé');
      console.error(error);
      setEditingMontantPaye(null);
      const newLocalUpdates = new Map(localMontantPayeUpdates);
      newLocalUpdates.delete(appointment.id.toString());
      setLocalMontantPayeUpdates(newLocalUpdates);
    }
  };

  const handleCommentaireClick = (appointment: RendezVous, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentValue = localCommentaireUpdates.get(appointment.id.toString()) ?? appointment.commentaireManuel ?? '';
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
      
      toast.success('Commentaire mis à jour');
      
      await refetchAppointments();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du commentaire');
      console.error(error);
      const newLocalUpdates = new Map(localCommentaireUpdates);
      newLocalUpdates.delete(appointment.id.toString());
      setLocalCommentaireUpdates(newLocalUpdates);
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
        <p className="table-data text-muted-foreground">Chargement du calendrier...</p>
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
              <th className="compta-mois-hour-header table-header border bg-muted/50"></th>
              {monthDays.map((date, index) => {
                const isSunday = date.getDay() === 0;
                return (
                  <th
                    key={index}
                    className={`compta-mois-day-header table-header border text-center ${
                      isSunday ? 'compta-mois-sunday-header' : 'bg-muted/50'
                    }`}
                  >
                    {getWeekdayAbbreviation(date)}
                  </th>
                );
              })}
            </tr>
            {/* Day number row */}
            <tr>
              <th className="compta-mois-hour-header table-header border bg-muted/50"></th>
              {monthDays.map((date, index) => {
                const isSunday = date.getDay() === 0;
                return (
                  <th
                    key={index}
                    className={`compta-mois-day-header table-header border text-center ${
                      isSunday ? 'compta-mois-sunday-header' : 'bg-muted/50'
                    }`}
                  >
                    {date.getDate()}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((timeSlot, slotIndex) => {
              const isHourMark = timeSlot.endsWith(':00');
              return (
                <tr key={slotIndex} className="compta-mois-time-row">
                  <td className="compta-mois-hour-cell table-data border bg-muted/30">
                    {timeSlot}
                  </td>
                  {monthDays.map((date, dayIndex) => {
                    const appointment = getAppointmentStartingAtTimeSlot(date, timeSlot);
                    const isSunday = date.getDay() === 0;

                    if (appointment) {
                      const rowSpan = Math.ceil(
                        (timeToMinutes(appointment.heureFin) - timeToMinutes(appointment.heureDebut)) / 30
                      );

                      let bgColor = 'bg-blue-50';
                      if (appointment.annule) {
                        bgColor = 'bg-red-100';
                      } else if (appointment.fait) {
                        bgColor = 'bg-green-100';
                      }

                      return (
                        <td
                          key={dayIndex}
                          rowSpan={rowSpan}
                          className={`compta-mois-day-cell table-data border ${bgColor} ${
                            isSunday ? 'compta-mois-sunday-appointment' : ''
                          } ${isHourMark ? 'has-separator' : ''} cursor-pointer hover:opacity-80`}
                          onClick={() => handleAppointmentClick(appointment)}
                        >
                          <div className="flex flex-col gap-0.5 p-0.5">
                            <div className="table-data font-semibold">{appointment.nomClient}</div>
                            <div className="table-data text-muted-foreground">
                              {appointment.heureDebut} - {appointment.heureFin}
                            </div>
                            <div className="table-data">{appointment.service}</div>
                            <div className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={appointment.fait}
                                onChange={(e) => handleToggleFait(appointment, e)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-3 h-3"
                              />
                              <span className="table-data">Fait</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={appointment.annule}
                                onChange={(e) => handleToggleAnnule(appointment, e)}
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
                                  onBlur={() => handleMontantPayeBlur(appointment)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="table-data w-16 px-1 border rounded"
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="table-data cursor-pointer hover:underline"
                                  onClick={(e) => handleMontantPayeClick(appointment, e)}
                                >
                                  {getDisplayedMontantPaye(appointment)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="table-data">Note:</span>
                              {editingCommentaire?.id === appointment.id ? (
                                <input
                                  type="text"
                                  value={editingCommentaire.value}
                                  onChange={handleCommentaireChange}
                                  onBlur={() => handleCommentaireBlur(appointment)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="table-data flex-1 px-1 border rounded"
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="table-data cursor-pointer hover:underline flex-1 truncate"
                                  onClick={(e) => handleCommentaireClick(appointment, e)}
                                  title={getDisplayedCommentaire(appointment)}
                                >
                                  {getDisplayedCommentaire(appointment) || '(vide)'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    }

                    const dayAppointments = getAppointmentForDay(date);
                    const isOccupied = dayAppointments.some((apt) =>
                      isTimeSlotInAppointmentRange(timeSlot, apt)
                    );

                    if (isOccupied) {
                      return null;
                    }

                    return (
                      <td
                        key={dayIndex}
                        className={`compta-mois-day-cell table-data border ${
                          isSunday ? 'compta-mois-sunday-empty' : 'bg-background'
                        } ${isHourMark ? 'has-separator' : ''}`}
                      ></td>
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
