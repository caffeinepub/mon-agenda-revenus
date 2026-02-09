import { useEffect, useState } from 'react';
import { useAddAppointment, useUpdateAppointment, useGetAllClientRecords } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { DemandeEdition, type RendezVous, type TypeRepetition, type JoursSemaine } from '../backend';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  appointment?: RendezVous | null;
  editMode?: DemandeEdition;
}

type RepetitionType = 'aucune' | 'hebdomadaire' | 'mensuelle' | 'annuelle';

export default function AppointmentDialog({
  open,
  onClose,
  appointment,
  editMode,
}: AppointmentDialogProps) {
  const { identity } = useInternetIdentity();
  const [formData, setFormData] = useState({
    date: '',
    heureDebut: '',
    heureFin: '',
    nomClient: '',
    referenceClient: '',
    numeroTelephone: '',
    adresse: '',
    service: '',
    notes: '',
    montantDu: '',
    repetitionType: 'aucune' as RepetitionType,
  });

  const [joursSemaine, setJoursSemaine] = useState<JoursSemaine>({
    lundi: false,
    mardi: false,
    mercredi: false,
    jeudi: false,
    vendredi: false,
    samedi: false,
    dimanche: false,
  });

  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const { data: clientRecords = [] } = useGetAllClientRecords();
  const addAppointment = useAddAppointment();
  const updateAppointment = useUpdateAppointment();

  useEffect(() => {
    if (appointment) {
      const date = new Date(Number(appointment.dateHeure) / 1000000);
      const dateStr = date.toISOString().split('T')[0];

      let repetitionType: RepetitionType = 'aucune';
      let jours: JoursSemaine = {
        lundi: false,
        mardi: false,
        mercredi: false,
        jeudi: false,
        vendredi: false,
        samedi: false,
        dimanche: false,
      };

      if (appointment.repetition.__kind__ === 'hebdomadaire') {
        repetitionType = 'hebdomadaire';
        jours = appointment.repetition.hebdomadaire;
      } else if (appointment.repetition.__kind__ === 'mensuelle') {
        repetitionType = 'mensuelle';
      } else if (appointment.repetition.__kind__ === 'annuelle') {
        repetitionType = 'annuelle';
      }

      setFormData({
        date: dateStr,
        heureDebut: appointment.heureDebut,
        heureFin: appointment.heureFin,
        nomClient: appointment.nomClient,
        referenceClient: appointment.referenceClient,
        numeroTelephone: appointment.numeroTelephone,
        adresse: appointment.adresse,
        service: appointment.service,
        notes: appointment.notes,
        montantDu: appointment.montantDu.toString(),
        repetitionType,
      });
      setJoursSemaine(jours);

      // Find matching client
      const matchingClient = clientRecords.find(
        (c) => c.referenceClient === appointment.referenceClient
      );
      if (matchingClient) {
        setSelectedClientId(matchingClient.id.toString());
      }
    } else {
      setFormData({
        date: '',
        heureDebut: '',
        heureFin: '',
        nomClient: '',
        referenceClient: '',
        numeroTelephone: '',
        adresse: '',
        service: '',
        notes: '',
        montantDu: '',
        repetitionType: 'aucune',
      });
      setJoursSemaine({
        lundi: false,
        mardi: false,
        mercredi: false,
        jeudi: false,
        vendredi: false,
        samedi: false,
        dimanche: false,
      });
      setSelectedClientId(null);
    }
  }, [appointment, clientRecords]);

  const handleClientSelect = (clientId: string) => {
    const client = clientRecords.find((c) => c.id.toString() === clientId);
    if (client) {
      setSelectedClientId(clientId);
      setFormData({
        ...formData,
        nomClient: client.clientName,
        referenceClient: client.referenceClient,
        numeroTelephone: client.phoneNumber,
        adresse: client.address,
        service: client.service,
      });
    }
    setClientSelectOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.referenceClient) {
      toast.error('La référence client est obligatoire');
      return;
    }

    if (!formData.nomClient) {
      toast.error('Le nom du client est obligatoire');
      return;
    }

    // Verify that the reference client exists in the client database
    const clientExists = clientRecords.some(
      (c) => c.referenceClient === formData.referenceClient
    );

    if (!clientExists) {
      toast.error(
        'La référence client doit correspondre à un client existant dans la Base Client. Veuillez sélectionner un client ou créer un nouveau client dans la Base Client.'
      );
      return;
    }

    if (!identity) {
      toast.error('Veuillez vous connecter pour créer un rendez-vous');
      return;
    }

    try {
      const dateTime = new Date(formData.date + 'T' + formData.heureDebut);
      const dateHeure = BigInt(dateTime.getTime() * 1000000);

      let repetition: TypeRepetition;
      if (formData.repetitionType === 'hebdomadaire') {
        repetition = { __kind__: 'hebdomadaire', hebdomadaire: joursSemaine };
      } else if (formData.repetitionType === 'mensuelle') {
        repetition = { __kind__: 'mensuelle', mensuelle: null };
      } else if (formData.repetitionType === 'annuelle') {
        repetition = { __kind__: 'annuelle', annuelle: null };
      } else {
        repetition = { __kind__: 'aucune', aucune: null };
      }

      const clientRef = {
        owner: identity.getPrincipal(),
        referenceClient: formData.referenceClient,
      };

      if (appointment && editMode) {
        await updateAppointment.mutateAsync({
          id: appointment.id,
          dateHeure,
          heureDebut: formData.heureDebut,
          heureFin: formData.heureFin,
          nomClient: formData.nomClient,
          referenceClient: formData.referenceClient,
          numeroTelephone: formData.numeroTelephone,
          adresse: formData.adresse,
          service: formData.service,
          notes: formData.notes,
          montantDu: BigInt(formData.montantDu || 0),
          repetition,
          demandeEdition: editMode,
          clientRef,
        });
        toast.success('Rendez-vous modifié avec succès');
      } else {
        await addAppointment.mutateAsync({
          dateHeure,
          heureDebut: formData.heureDebut,
          heureFin: formData.heureFin,
          nomClient: formData.nomClient,
          referenceClient: formData.referenceClient,
          numeroTelephone: formData.numeroTelephone,
          adresse: formData.adresse,
          service: formData.service,
          notes: formData.notes,
          montantDu: BigInt(formData.montantDu || 0),
          repetition,
          clientRef,
        });
        toast.success('Rendez-vous ajouté avec succès');
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving appointment:', error);
      const errorMessage = error.message || String(error);
      
      if (errorMessage.includes('référence client') || errorMessage.includes('client reference')) {
        toast.error('La référence client doit correspondre à un client existant dans la Base Client');
      } else if (errorMessage.includes('Non autorisé') || errorMessage.includes('Unauthorized')) {
        toast.error('Non autorisé : Veuillez vous reconnecter et réessayer');
      } else {
        toast.error(errorMessage || 'Erreur lors de l\'enregistrement');
      }
    }
  };

  const isLoading = addAppointment.isPending || updateAppointment.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {appointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          </DialogTitle>
          <DialogDescription>
            {appointment
              ? 'Modifiez les informations du rendez-vous'
              : 'Créez un nouveau rendez-vous'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Client *</Label>
            <Popover open={clientSelectOpen} onOpenChange={setClientSelectOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientSelectOpen}
                  className="w-full justify-between"
                  type="button"
                  disabled={isLoading}
                >
                  {selectedClientId
                    ? (() => {
                        const client = clientRecords.find(
                          (c) => c.id.toString() === selectedClientId
                        );
                        return client
                          ? `${client.clientName} (${client.referenceClient})`
                          : 'Sélectionner un client...';
                      })()
                    : 'Sélectionner un client...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Rechercher un client..." />
                  <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      {clientRecords.map((client) => (
                        <CommandItem
                          key={client.id.toString()}
                          value={`${client.clientName} ${client.referenceClient}`}
                          onSelect={() => handleClientSelect(client.id.toString())}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedClientId === client.id.toString()
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {client.clientName} ({client.referenceClient})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Sélectionnez un client existant. La référence client est obligatoire.
            </p>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heureDebut">Heure début *</Label>
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
              <Label htmlFor="heureFin">Heure fin *</Label>
              <Input
                id="heureFin"
                type="time"
                value={formData.heureFin}
                onChange={(e) => setFormData({ ...formData, heureFin: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Client Details (read-only when client selected) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomClient">Nom du client *</Label>
              <Input
                id="nomClient"
                value={formData.nomClient}
                onChange={(e) => setFormData({ ...formData, nomClient: e.target.value })}
                required
                disabled={isLoading || !!selectedClientId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referenceClient">Référence client *</Label>
              <Input
                id="referenceClient"
                value={formData.referenceClient}
                onChange={(e) =>
                  setFormData({ ...formData, referenceClient: e.target.value })
                }
                required
                disabled={isLoading || !!selectedClientId}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numeroTelephone">Téléphone</Label>
              <Input
                id="numeroTelephone"
                value={formData.numeroTelephone}
                onChange={(e) =>
                  setFormData({ ...formData, numeroTelephone: e.target.value })
                }
                disabled={isLoading || !!selectedClientId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adresse">Adresse</Label>
              <Input
                id="adresse"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                disabled={isLoading || !!selectedClientId}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Service</Label>
            <Input
              id="service"
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              disabled={isLoading || !!selectedClientId}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="montantDu">Montant dû</Label>
            <Input
              id="montantDu"
              type="number"
              min="0"
              value={formData.montantDu}
              onChange={(e) => setFormData({ ...formData, montantDu: e.target.value })}
              disabled={isLoading}
            />
          </div>

          {/* Repetition */}
          <div className="space-y-2">
            <Label htmlFor="repetition">Répétition</Label>
            <Select
              value={formData.repetitionType}
              onValueChange={(value: RepetitionType) =>
                setFormData({ ...formData, repetitionType: value })
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aucune">Aucune</SelectItem>
                <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                <SelectItem value="mensuelle">Mensuelle</SelectItem>
                <SelectItem value="annuelle">Annuelle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.repetitionType === 'hebdomadaire' && (
            <div className="space-y-2">
              <Label>Jours de la semaine</Label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(joursSemaine).map(([jour, checked]) => (
                  <div key={jour} className="flex items-center space-x-2">
                    <Checkbox
                      id={jour}
                      checked={checked}
                      onCheckedChange={(checked) =>
                        setJoursSemaine({ ...joursSemaine, [jour]: !!checked })
                      }
                      disabled={isLoading}
                    />
                    <Label htmlFor={jour} className="capitalize cursor-pointer">
                      {jour}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                  Enregistrement...
                </>
              ) : appointment ? (
                'Modifier'
              ) : (
                'Créer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
