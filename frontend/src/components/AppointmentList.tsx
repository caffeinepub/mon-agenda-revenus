import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin } from 'lucide-react';
import type { RendezVous, TypeRepetition } from '../backend';
import AppointmentActionDialog from './AppointmentActionDialog';

interface AppointmentListProps {
  appointments: RendezVous[];
  unpaidCount?: number;
}

export default function AppointmentList({ appointments, unpaidCount }: AppointmentListProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<RendezVous | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);

  const handleAppointmentAction = (appointment: RendezVous) => {
    setSelectedAppointment(appointment);
    setIsActionDialogOpen(true);
  };

  const handleCloseActionDialog = () => {
    setIsActionDialogOpen(false);
    setSelectedAppointment(null);
  };

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRepetitionLabel = (repetition: TypeRepetition): string => {
    switch (repetition.__kind__) {
      case 'aucune':
        return 'Aucune';
      case 'hebdomadaire': {
        const jours = repetition.hebdomadaire;
        const selectedDays: string[] = [];
        if (jours.lundi) selectedDays.push('Lun');
        if (jours.mardi) selectedDays.push('Mar');
        if (jours.mercredi) selectedDays.push('Mer');
        if (jours.jeudi) selectedDays.push('Jeu');
        if (jours.vendredi) selectedDays.push('Ven');
        if (jours.samedi) selectedDays.push('Sam');
        if (jours.dimanche) selectedDays.push('Dim');
        return selectedDays.length > 0 
          ? `Hebdomadaire (${selectedDays.join(', ')})`
          : 'Hebdomadaire';
      }
      case 'mensuelle':
        return 'Mensuelle';
      case 'annuelle':
        return 'Annuelle';
      default:
        return 'Aucune';
    }
  };

  const sortedAppointments = [...appointments].sort((a, b) => {
    return Number(a.dateHeure) - Number(b.dateHeure);
  });

  const paidAppointments = sortedAppointments.filter((apt) => apt.montantPaye > 0);
  const unpaidAppointments = sortedAppointments.filter((apt) => apt.montantPaye === BigInt(0));

  const renderAppointmentCard = (appointment: RendezVous) => {
    const isPaid = appointment.montantPaye > 0;
    const timeRange = appointment.heureDebut && appointment.heureFin 
      ? `${appointment.heureDebut} - ${appointment.heureFin}`
      : '';

    return (
      <Card key={appointment.id.toString()} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">
                  {appointment.nomClient}
                  {appointment.referenceClient && (
                    <span className="text-muted-foreground font-normal"> – Réf: {appointment.referenceClient}</span>
                  )}
                </h3>
                {isPaid ? (
                  <Badge variant="default" className="bg-success text-success-foreground">
                    Payé
                  </Badge>
                ) : (
                  <Badge variant="destructive">Non payé</Badge>
                )}
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium">📅</span>
                  <span>{formatDate(appointment.dateHeure)} {timeRange && `à ${timeRange}`}</span>
                </div>

                {appointment.numeroTelephone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{appointment.numeroTelephone}</span>
                  </div>
                )}

                {appointment.adresse && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{appointment.adresse}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="font-medium">Service:</span>
                  <span>{appointment.service}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-medium">Montant dû:</span>
                  <span className="font-semibold text-foreground">
                    {Number(appointment.montantDu)} €
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-medium">Montant payé:</span>
                  <span className="font-semibold text-green-600">
                    {Number(appointment.montantPaye)} €
                  </span>
                </div>

                {appointment.repetition.__kind__ !== 'aucune' && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Répétition:</span>
                    <Badge variant="outline">{getRepetitionLabel(appointment.repetition)}</Badge>
                  </div>
                )}

                {appointment.notes && (
                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                    <span className="font-medium">Notes: </span>
                    {appointment.notes}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAppointmentAction(appointment)}
              >
                Modifier ou Supprimer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Use backend-calculated unpaidCount if provided, otherwise fallback to client-side calculation
  const displayUnpaidCount = unpaidCount !== undefined ? unpaidCount : unpaidAppointments.length;

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Listing des rendez-vous</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                Tous ({sortedAppointments.length})
              </TabsTrigger>
              <TabsTrigger value="paid">
                Payés ({paidAppointments.length})
              </TabsTrigger>
              <TabsTrigger value="unpaid">
                Non payés ({displayUnpaidCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-4">
              {sortedAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Aucun rendez-vous pour le moment</p>
                </div>
              ) : (
                sortedAppointments.map(renderAppointmentCard)
              )}
            </TabsContent>

            <TabsContent value="paid" className="space-y-4 mt-4">
              {paidAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Aucun rendez-vous payé</p>
                </div>
              ) : (
                paidAppointments.map(renderAppointmentCard)
              )}
            </TabsContent>

            <TabsContent value="unpaid" className="space-y-4 mt-4">
              {unpaidAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Aucun rendez-vous non payé</p>
                </div>
              ) : (
                unpaidAppointments.map(renderAppointmentCard)
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AppointmentActionDialog
        open={isActionDialogOpen}
        onClose={handleCloseActionDialog}
        appointment={selectedAppointment}
      />
    </>
  );
}
