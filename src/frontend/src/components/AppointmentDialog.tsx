import { useState, useEffect } from 'react';
import { useAddAppointment, useUpdateAppointment, useGetAllClientRecords } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { RendezVous, TypeRepetition, ClientReference } from '../backend';
import { DemandeEdition } from '../backend';

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: RendezVous | null;
  initialDate?: Date;
  demandeEdition?: DemandeEdition;
}

export default function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  initialDate,
  demandeEdition = DemandeEdition.unique,
}: AppointmentDialogProps) {
  const { identity } = useInternetIdentity();
  const { data: clientRecords = [] } = useGetAllClientRecords();
  const addAppointment = useAddAppointment();
  const updateAppointment = useUpdateAppointment();

  const [formData, setFormData] = useState({
    dateHeure: initialDate || new Date(),
    heureDebut: '09:00',
    heureFin: '10:00',
    nomClient: '',
    referenceClient: '',
    numeroTelephone: '',
    adresse: '',
    service: '',
    notes: '',
    montantDu: '',
    repetition: { __kind__: 'aucune' as const, aucune: null } as TypeRepetition,
  });

  useEffect(() => {
    if (appointment) {
      const date = new Date(Number(appointment.dateHeure) / 1_000_000);
      setFormData({
        dateHeure: date,
        heureDebut: appointment.heureDebut,
        heureFin: appointment.heureFin,
        nomClient: appointment.nomClient,
        referenceClient: appointment.referenceClient,
        numeroTelephone: appointment.numeroTelephone,
        adresse: appointment.adresse,
        service: appointment.service,
        notes: appointment.notes,
        montantDu: appointment.montantDu.toString(),
        repetition: appointment.repetition,
      });
    } else if (initialDate) {
      setFormData(prev => ({ ...prev, dateHeure: initialDate }));
    }
  }, [appointment, initialDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nomClient || !formData.referenceClient) {
      toast.error('Veuillez remplir le nom et la référence client');
      return;
    }

    if (!identity) {
      toast.error('Veuillez vous connecter pour créer un rendez-vous');
      return;
    }

    // Check for duplicate reference when creating a new appointment
    if (!appointment) {
      const isDuplicate = clientRecords.some(
        client => client.referenceClient.toLowerCase() === formData.referenceClient.toLowerCase()
      );
      
      if (isDuplicate) {
        toast.error('Cette référence client est déjà utilisée. Veuillez choisir une référence unique ou utiliser la référence existante.');
        return;
      }
    }

    const dateTimeNanos = BigInt(formData.dateHeure.getTime()) * BigInt(1_000_000);
    const montantDu = BigInt(formData.montantDu || '0');

    const clientRef: ClientReference = {
      owner: identity.getPrincipal(),
      referenceClient: formData.referenceClient,
    };

    try {
      if (appointment) {
        await updateAppointment.mutateAsync({
          id: appointment.id,
          dateHeure: dateTimeNanos,
          heureDebut: formData.heureDebut,
          heureFin: formData.heureFin,
          nomClient: formData.nomClient,
          referenceClient: formData.referenceClient,
          numeroTelephone: formData.numeroTelephone,
          adresse: formData.adresse,
          service: formData.service,
          notes: formData.notes,
          montantDu,
          repetition: formData.repetition,
          demandeEdition,
          clientRef,
        });
        toast.success('Rendez-vous modifié avec succès');
      } else {
        await addAppointment.mutateAsync({
          dateHeure: dateTimeNanos,
          heureDebut: formData.heureDebut,
          heureFin: formData.heureFin,
          nomClient: formData.nomClient,
          referenceClient: formData.referenceClient,
          numeroTelephone: formData.numeroTelephone,
          adresse: formData.adresse,
          service: formData.service,
          notes: formData.notes,
          montantDu,
          repetition: formData.repetition,
          clientRef,
        });
        toast.success('Rendez-vous créé avec succès');
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving appointment:', error);
      const errorMessage = error.message || String(error);
      
      if (errorMessage.includes('déjà utilisée') || errorMessage.includes('already used')) {
        toast.error('Cette référence client est déjà utilisée. Veuillez choisir une référence unique.');
      } else if (errorMessage.includes('référence client') || errorMessage.includes('obligatoire')) {
        toast.error('La référence client est obligatoire et doit être unique');
      } else if (errorMessage.includes('Non autorisé') || errorMessage.includes('Unauthorized')) {
        toast.error('Non autorisé : Veuillez vous reconnecter et réessayer');
      } else {
        toast.error(errorMessage || 'Erreur lors de l\'enregistrement');
      }
    }
  };

  const isLoading = addAppointment.isPending || updateAppointment.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {appointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          </DialogTitle>
          <DialogDescription>
            {appointment
              ? 'Modifiez les informations du rendez-vous'
              : 'Créez un nouveau rendez-vous pour un client'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateHeure">Date</Label>
              <Input
                id="dateHeure"
                type="date"
                value={formData.dateHeure.toISOString().split('T')[0]}
                onChange={(e) =>
                  setFormData({ ...formData, dateHeure: new Date(e.target.value) })
                }
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heureDebut">Heure de début</Label>
              <Input
                id="heureDebut"
                type="time"
                value={formData.heureDebut}
                onChange={(e) =>
                  setFormData({ ...formData, heureDebut: e.target.value })
                }
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heureFin">Heure de fin</Label>
              <Input
                id="heureFin"
                type="time"
                value={formData.heureFin}
                onChange={(e) =>
                  setFormData({ ...formData, heureFin: e.target.value })
                }
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="montantDu">Montant dû</Label>
              <Input
                id="montantDu"
                type="number"
                min="0"
                value={formData.montantDu}
                onChange={(e) =>
                  setFormData({ ...formData, montantDu: e.target.value })
                }
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceClient">Référence Client *</Label>
              <Input
                id="referenceClient"
                placeholder="REF-2026-001"
                value={formData.referenceClient}
                onChange={(e) =>
                  setFormData({ ...formData, referenceClient: e.target.value })
                }
                required
                disabled={isLoading || !!appointment}
              />
              {!appointment && (
                <p className="text-xs text-muted-foreground">
                  Doit être unique. La référence ne peut pas être modifiée après création.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomClient">Nom du client *</Label>
              <Input
                id="nomClient"
                placeholder="Jean Dupont"
                value={formData.nomClient}
                onChange={(e) =>
                  setFormData({ ...formData, nomClient: e.target.value })
                }
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroTelephone">Numéro de téléphone</Label>
              <Input
                id="numeroTelephone"
                placeholder="+33 6 12 34 56 78"
                value={formData.numeroTelephone}
                onChange={(e) =>
                  setFormData({ ...formData, numeroTelephone: e.target.value })
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adresse">Adresse</Label>
              <Input
                id="adresse"
                placeholder="123 Rue de la Paix, Paris"
                value={formData.adresse}
                onChange={(e) =>
                  setFormData({ ...formData, adresse: e.target.value })
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="service">Service</Label>
              <Input
                id="service"
                placeholder="Consultation"
                value={formData.service}
                onChange={(e) =>
                  setFormData({ ...formData, service: e.target.value })
                }
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Notes supplémentaires..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Enregistrement...
                </>
              ) : appointment ? (
                'Modifier'
              ) : (
                'Créer'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
