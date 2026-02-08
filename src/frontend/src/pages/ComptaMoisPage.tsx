import { useState, useMemo, useEffect } from 'react';
import { useGetAllAppointments, useUpdateAppointmentStatus, useUpdateMontantPaye, useGetMonthlyListing } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RendezVous } from '../backend';
import { toast } from 'sonner';
import AppointmentActionDialog from '../components/AppointmentActionDialog';
import { isInMonth, isNotFuture } from '../utils/timeRange';
import { bigintAbs } from '../utils/bigintMath';

// Helper functions defined outside component to prevent re-creation
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatNumber = (amount: bigint) => {
  return Number(amount).toLocaleString('fr-FR');
};

const getWeekdayAbbreviation = (date: Date): string => {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return days[date.getDay()];
};

export default function ComptaMoisPage() {
  // All hooks at the top level - strict initialization order
  const { data: appointments = [], isLoading, refetch: refetchAppointments } = useGetAllAppointments();
  const updateStatusMutation = useUpdateAppointmentStatus();
  const updateMontantPayeMutation = useUpdateMontantPaye();
  
  // All state hooks
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [editingMontantPaye, setEditingMontantPaye] = useState<{ id: bigint; value: string } | null>(null);
  const [editingCommentaire, setEditingCommentaire] = useState<{ id: bigint; value: string } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<RendezVous | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [localMontantPayeUpdates, setLocalMontantPayeUpdates] = useState<Map<string, bigint>>(new Map());
  const [localCommentaireUpdates, setLocalCommentaireUpdates] = useState<Map<string, string>>(new Map());

  // Get monthly listing data for "Dus (RDV Faits ; Mois Courant)" and "Revenus du Mois en Cours (Faits et Payés)" calculations
  const currentYear = currentMonth.getFullYear();
  const currentMonthNum = currentMonth.getMonth() + 1;
  const { data: monthlyListingData, refetch: refetchMonthlyListing } = useGetMonthlyListing(currentYear, currentMonthNum);

  // Refetch monthly listing when month changes
  useEffect(() => {
    refetchMonthlyListing();
  }, [currentYear, currentMonthNum, refetchMonthlyListing]);

  // Memoized values - all defined before any effects or handlers
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

  const monthlyFinancialStats = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;

    let totalRendezVousFaits = BigInt(0);
    let totalPaye = BigInt(0);

    appointments.forEach((apt) => {
      // Use precise bigint comparison for month filtering
      if (isInMonth(apt.dateHeure, year, month) && isNotFuture(apt.dateHeure)) {
        // Only count appointments marked as "fait"
        if (apt.fait) {
          // RDV faits (Payés et Impayés ; Mois Courant): total of montantDu for "fait" appointments (excluding future)
          totalRendezVousFaits += apt.montantDu;
          
          // Revenus + Avances (RDV Payés + Avances ; Mois Courant): total of montantPaye for "fait" appointments
          totalPaye += apt.montantPaye;
        }
      }
    });

    // Calculate "Dus (RDV Faits ; Mois Courant)" from Listing Mensuel's negative balance column
    let totalEnAttente = BigInt(0);
    // Calculate "Revenus du Mois en Cours (Faits et Payés)" as (Total RDV Faits + Solde restant négatif)
    let totalReelRecu = BigInt(0);
    
    if (monthlyListingData && monthlyListingData[0]) {
      const listings = monthlyListingData[0];
      listings.forEach((client) => {
        if (client.soldeRestant < BigInt(0)) {
          totalEnAttente += bigintAbs(client.soldeRestant);
        }
        // CORRECTED FORMULA: Revenus du Mois en Cours (Faits et Payés) = Total RDV Faits + Solde restant négatif (excluding positive balance)
        const soldeNegatif = client.soldeRestant < BigInt(0) ? client.soldeRestant : BigInt(0);
        totalReelRecu += BigInt(Number(client.totalDuMois) + Number(soldeNegatif));
      });
    }

    return { totalRendezVousFaits, totalPaye, totalEnAttente, totalReelRecu };
  }, [appointments, currentMonth, monthlyListingData]);

  // Effects
  useEffect(() => {
    setLocalMontantPayeUpdates(new Map());
    setLocalCommentaireUpdates(new Map());
  }, [appointments]);

  // Helper functions that depend on state/props
  const isTimeSlotInAppointmentRange = (timeSlot: string, appointment: RendezVous): boolean => {
    const slotMinutes = timeToMinutes(timeSlot);
    const startMinutes = timeToMinutes(appointment.heureDebut);
    const endMinutes = timeToMinutes(appointment.heureFin);
    
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  };

  const getAppointmentStartingAtTimeSlot = (date: Date, timeSlot: string): RendezVous | null => {
    // Find appointment that starts exactly at this time slot
    return appointments.find((apt) => {
      const aptDate = new Date(Number(apt.dateHeure) / 1000000);
      if (aptDate.toDateString() !== date.toDateString()) {
        return false;
      }
      // Check if appointment starts at this exact time slot
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

  // Event handlers
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

  const handleToggleFait = async (appointment: RendezVous, e: React.MouseEvent) => {
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

  const handleToggleAnnule = async (appointment: RendezVous, e: React.MouseEvent) => {
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

  const handleMontantPayeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, appointment: RendezVous) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMontantPayeBlur(appointment);
    } else if (e.key === 'Escape') {
      setEditingMontantPaye(null);
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
    
    try {
      const newLocalUpdates = new Map(localCommentaireUpdates);
      newLocalUpdates.set(appointment.id.toString(), inputValue);
      setLocalCommentaireUpdates(newLocalUpdates);
      
      setEditingCommentaire(null);
      
      await updateStatusMutation.mutateAsync({
        id: appointment.id,
        commentaireManuel: inputValue,
      });
      
      toast.success('Commentaire mis à jour');
      
      await refetchAppointments();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du commentaire');
      console.error(error);
      setEditingCommentaire(null);
      const newLocalUpdates = new Map(localCommentaireUpdates);
      newLocalUpdates.delete(appointment.id.toString());
      setLocalCommentaireUpdates(newLocalUpdates);
    }
  };

  const handleCommentaireKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, appointment: RendezVous) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommentaireBlur(appointment);
    } else if (e.key === 'Escape') {
      setEditingCommentaire(null);
    }
  };

  const handleClientNameClick = (appointment: RendezVous, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAppointment(appointment);
    setShowActionDialog(true);
  };

  // Early return for loading state
  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Compta Mois</h2>
          <p className="text-muted-foreground">Vue mensuelle complète de vos rendez-vous</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="container py-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Compta Mois</h2>
        <p className="text-muted-foreground">Vue mensuelle complète de vos rendez-vous</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle style={{ fontFamily: 'Cambria, serif', fontSize: '12px' }}>
            Résumé financier mensuel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-950/20 p-2">
              <div className="text-sm font-medium text-muted-foreground" style={{ fontFamily: 'Cambria, serif', fontSize: '12px' }}>
                RDV faits (Payés et Impayés ; Mois Courant)
              </div>
              <div className="mt-1 text-xl font-bold text-green-600 dark:text-green-500" style={{ fontFamily: 'Cambria, serif', fontSize: '12px' }}>
                {formatNumber(monthlyFinancialStats.totalRendezVousFaits)}
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-950/20 p-2">
              <div className="text-sm font-medium text-muted-foreground" style={{ fontFamily: 'Cambria, serif', fontSize: '12px' }}>
                Revenus + Avances (RDV Payés + Avances ; Mois Courant)
              </div>
              <div className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-500" style={{ fontFamily: 'Cambria, serif', fontSize: '12px' }}>
                {formatNumber(monthlyFinancialStats.totalPaye)}
              </div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900/30 dark:bg-orange-950/20 p-2">
              <div className="text-sm font-medium text-muted-foreground" style={{ fontFamily: 'Cambria, serif', fontSize: '12px' }}>
                Dus (RDV Faits ; Mois Courant)
              </div>
              <div className="mt-1 text-xl font-bold text-orange-600 dark:text-orange-500" style={{ fontFamily: 'Cambria, serif', fontSize: '12px' }}>
                {formatNumber(monthlyFinancialStats.totalEnAttente)}
              </div>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-900/30 dark:bg-purple-950/20 p-2">
              <div className="text-sm font-medium text-muted-foreground" style={{ fontFamily: 'Cambria, serif', fontSize: '12px' }}>
                Revenus du Mois en Cours (Faits et Payés)
              </div>
              <div className="mt-1 text-xl font-bold text-purple-600 dark:text-purple-500" style={{ fontFamily: 'Cambria, serif', fontSize: '12px' }}>
                {formatNumber(monthlyFinancialStats.totalReelRecu)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl" style={{ fontFamily: 'Cambria, serif' }}>{formatMonthYear()}</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToCurrentMonth} style={{ fontSize: '8px', padding: '4px 8px' }}>
                Mois actuel
              </Button>
              <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="h-6 w-6">
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-6 w-6">
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full h-[calc(100vh-400px)] overflow-auto">
            <div className="min-w-max">
              <table className="compta-mois-table w-full" style={{ fontFamily: 'Cambria, serif', fontSize: '8px', tableLayout: 'auto' }}>
                <thead className="sticky top-0 z-10 bg-card">
                  <tr>
                    <th 
                      className="border border-border bg-muted/50 p-0.5 text-left font-semibold"
                      style={{ fontSize: '8px', fontFamily: 'Cambria, serif', width: '35px', minWidth: '35px' }}
                    >
                      Heure
                    </th>
                    {monthDays.map((date, index) => {
                      const isToday = new Date().toDateString() === date.toDateString();
                      const isSunday = date.getDay() === 0;
                      const dayOfMonth = date.getDate();
                      const weekdayAbbr = getWeekdayAbbreviation(date);
                      
                      return (
                        <th
                          key={index}
                          className={`border border-border p-0.5 text-center font-semibold ${
                            isToday ? 'bg-primary/10' : 
                            isSunday ? 'bg-red-100 dark:bg-red-950/30' : 
                            'bg-muted/50'
                          }`}
                          style={{ 
                            fontSize: '8px', 
                            fontFamily: 'Cambria, serif', 
                            width: 'auto', 
                            minWidth: '30px',
                            maxWidth: '30px',
                            padding: '1px'
                          }}
                        >
                          <div className="flex flex-col whitespace-nowrap">
                            <span className={`text-[7px] ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{weekdayAbbr}</span>
                            <span className={isToday ? 'text-primary' : ''}>{dayOfMonth}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((timeSlot) => (
                    <tr key={timeSlot} style={{ height: '14px' }}>
                      <td 
                        className="compta-mois-hour-cell border border-border bg-muted/30 p-0 font-medium text-muted-foreground"
                        style={{ fontSize: '8px', fontFamily: 'Cambria, serif', height: '14px' }}
                      >
                        {timeSlot}
                      </td>
                      {monthDays.map((date, dayIndex) => {
                        // Check if an appointment starts exactly at this time slot
                        const appointmentStartingHere = getAppointmentStartingAtTimeSlot(date, timeSlot);
                        const dayAppointments = getAppointmentForDay(date);
                        const isInAppointmentRange = dayAppointments.some(apt => 
                          isTimeSlotInAppointmentRange(timeSlot, apt)
                        );
                        const isToday = new Date().toDateString() === date.toDateString();
                        const isSunday = date.getDay() === 0;
                        
                        const isLastSlotOfAppointment = dayAppointments.some(apt => {
                          const endMinutes = timeToMinutes(apt.heureFin);
                          const slotMinutes = timeToMinutes(timeSlot);
                          return slotMinutes + 30 === endMinutes;
                        });
                        
                        return (
                          <td
                            key={dayIndex}
                            className={`compta-mois-day-cell border border-border p-0 ${
                              isToday ? 'bg-primary/5' : isSunday ? 'bg-red-50 dark:bg-red-950/10' : ''
                            } ${
                              isInAppointmentRange ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                            } ${
                              isLastSlotOfAppointment ? 'has-separator' : ''
                            }`}
                            style={{ height: '14px', fontSize: '8px', verticalAlign: 'middle', padding: '0' }}
                          >
                            {appointmentStartingHere && (
                              <div 
                                className="flex flex-col gap-0.5 w-full"
                                style={{ fontFamily: 'Cambria, serif', fontSize: '8px', padding: '0.5px', margin: '0', lineHeight: '1' }}
                              >
                                <div className="flex items-start gap-0.5">
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <button
                                      onClick={(e) => handleClientNameClick(appointmentStartingHere, e)}
                                      className="px-0.5 py-0.5 rounded text-blue-900 dark:text-blue-100 bg-blue-100 dark:bg-blue-950/50 whitespace-nowrap hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors cursor-pointer text-left truncate"
                                      style={{ fontSize: '8px', lineHeight: '1' }}
                                      title="Cliquer pour modifier ou supprimer"
                                    >
                                      {appointmentStartingHere.nomClient}
                                    </button>
                                    {appointmentStartingHere.referenceClient && (
                                      <span 
                                        className="px-0.5 text-xs text-muted-foreground truncate"
                                        style={{ fontSize: '8px', fontFamily: 'Cambria, serif', lineHeight: '1' }}
                                      >
                                        {appointmentStartingHere.referenceClient}
                                      </span>
                                    )}
                                    <div 
                                      className="px-0.5 py-0.5 rounded text-orange-900 dark:text-orange-100 bg-orange-100 dark:bg-orange-950/50 text-center whitespace-nowrap"
                                      style={{ fontSize: '8px', fontFamily: 'Cambria, serif', lineHeight: '1' }}
                                      title="Montant dû"
                                    >
                                      Dû: {Number(appointmentStartingHere.montantDu)}
                                    </div>
                                    {editingMontantPaye?.id === appointmentStartingHere.id ? (
                                      <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={editingMontantPaye.value}
                                        onChange={handleMontantPayeChange}
                                        onBlur={() => handleMontantPayeBlur(appointmentStartingHere)}
                                        onKeyDown={(e) => handleMontantPayeKeyDown(e, appointmentStartingHere)}
                                        className="px-0.5 py-0.5 rounded text-green-900 dark:text-green-100 bg-green-100 dark:bg-green-950/50 text-center border border-green-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        style={{ fontSize: '8px', fontFamily: 'Cambria, serif', width: '100%', lineHeight: '1' }}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <button
                                        onClick={(e) => handleMontantPayeClick(appointmentStartingHere, e)}
                                        className="px-0.5 py-0.5 rounded text-green-900 dark:text-green-100 bg-green-100 dark:bg-green-950/50 text-center hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors cursor-pointer whitespace-nowrap"
                                        style={{ fontSize: '8px', fontFamily: 'Cambria, serif', lineHeight: '1' }}
                                        title="Montant payé (cliquer pour modifier)"
                                      >
                                        Payé: {getDisplayedMontantPaye(appointmentStartingHere)}
                                      </button>
                                    )}
                                    {editingCommentaire?.id === appointmentStartingHere.id ? (
                                      <input
                                        type="text"
                                        value={editingCommentaire.value}
                                        onChange={handleCommentaireChange}
                                        onBlur={() => handleCommentaireBlur(appointmentStartingHere)}
                                        onKeyDown={(e) => handleCommentaireKeyDown(e, appointmentStartingHere)}
                                        className="px-0.5 py-0.5 rounded text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-950/50 text-left border border-gray-500"
                                        style={{ fontSize: '7px', fontFamily: 'Cambria, serif', width: '100%', lineHeight: '1' }}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                        placeholder="Commentaire..."
                                      />
                                    ) : (
                                      <button
                                        onClick={(e) => handleCommentaireClick(appointmentStartingHere, e)}
                                        className="px-0.5 py-0.5 rounded text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-950/50 text-left hover:bg-gray-200 dark:hover:bg-gray-900/50 transition-colors cursor-pointer truncate"
                                        style={{ fontSize: '7px', fontFamily: 'Cambria, serif', lineHeight: '1' }}
                                        title="Commentaire (cliquer pour modifier)"
                                      >
                                        {getDisplayedCommentaire(appointmentStartingHere) || 'Commentaire...'}
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                                    <button
                                      onClick={(e) => handleToggleFait(appointmentStartingHere, e)}
                                      className={`w-3 h-3 rounded border transition-colors ${
                                        appointmentStartingHere.fait
                                          ? 'bg-green-400 border-green-500'
                                          : 'bg-green-100 border-green-300 dark:bg-green-950/30 dark:border-green-800'
                                      }`}
                                      title="Fait"
                                      aria-label="Marquer comme fait"
                                    >
                                      {appointmentStartingHere.fait && (
                                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </button>
                                    
                                    <button
                                      onClick={(e) => handleToggleAnnule(appointmentStartingHere, e)}
                                      className={`w-3 h-3 rounded border transition-colors ${
                                        appointmentStartingHere.annule
                                          ? 'bg-red-400 border-red-500'
                                          : 'bg-red-100 border-red-300 dark:bg-red-950/30 dark:border-red-800'
                                      }`}
                                      title="Annulé"
                                      aria-label="Marquer comme annulé"
                                    >
                                      {appointmentStartingHere.annule && (
                                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <AppointmentActionDialog
        open={showActionDialog}
        onClose={() => setShowActionDialog(false)}
        appointment={selectedAppointment}
      />
    </div>
  );
}
