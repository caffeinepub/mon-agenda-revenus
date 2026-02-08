import { useEffect, useState } from 'react';
import { useAddAppointment, useUpdateAppointment, useGetAllClientRecords } from '../hooks/useQueries';
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
        heureDebut: appointment.heureDebut || '',
        heureFin: appointment.heureFin || '',
        nomClient: appointment.nomClient,
        referenceClient: appointment.referenceClient || '',
        numeroTelephone: appointment.numeroTelephone,
        adresse: appointment.adresse,
        service: appointment.service,
        notes: appointment.notes,
        montantDu: appointment.montantDu.toString(),
        repetitionType,
      });
      setJoursSemaine(jours);

      // Try to find matching client
      const matchingClient = clientRecords.find(
        (c) => c.referenceClient === appointment.referenceClient
      );
      setSelectedClientId(matchingClient ? matchingClient.id.toString() : null);
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
  }, [appointment, open, clientRecords]);

  const handleClientSelect = (clientId: string) => {
    const client = clientRecords.find((c) => c.id.toString() === clientId);
    if (client) {
      setFormData({
        ...formData,
        nomClient: client.clientName,
        referenceClient: client.referenceClient,
        numeroTelephone: client.phoneNumber,
        adresse: client.address,
        service: client.service,
        notes: client.notes,
      });
      setSelectedClientId(clientId);
    }
    setClientSelectOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.nomClient || !formData.service || !formData.montantDu) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!formData.heureDebut || !formData.heureFin) {
      toast.error('Veuillez renseigner les heures de début et de fin');
      return;
    }

    // Validate weekly repetition
    if (formData.repetitionType === 'hebdomadaire') {
      const hasSelectedDay = Object.values(joursSemaine).some(day => day);
      if (!hasSelectedDay) {
        toast.error('Veuillez sélectionner au moins un jour de la semaine pour la répétition hebdomadaire');
        return;
      }
    }

    const dateTime = new Date(`${formData.date}T${formData.heureDebut}`);
    const timestamp = BigInt(dateTime.getTime() * 1000000);
    const montant = BigInt(Math.round(parseFloat(formData.montantDu) * 100) / 100);

    // Build TypeRepetition based on selection
    let repetition: TypeRepetition;
    if (formData.repetitionType === 'hebdomadaire') {
      repetition = {
        __kind__: 'hebdomadaire',
        hebdomadaire: joursSemaine,
      };
    } else if (formData.repetitionType === 'mensuelle') {
      repetition = {
        __kind__: 'mensuelle',
        mensuelle: null,
      };
    } else if (formData.repetitionType === 'annuelle') {
      repetition = {
        __kind__: 'annuelle',
        annuelle: null,
      };
    } else {
      repetition = {
        __kind__: 'aucune',
        aucune: null,
      };
    }

    try {
      if (appointment) {
        await updateAppointment.mutateAsync({
          id: appointment.id,
          dateHeure: timestamp,
          heureDebut: formData.heureDebut,
          heureFin: formData.heureFin,
          nomClient: formData.nomClient,
          referenceClient: formData.referenceClient,
          numeroTelephone: formData.numeroTelephone,
          adresse: formData.adresse,
          service: formData.service,
          notes: formData.notes,
          montantDu: montant,
          repetition,
          demandeEdition: editMode || DemandeEdition.unique,
        });
        toast.success(
          editMode === DemandeEdition.futursDuClient
            ? 'Rendez-vous futurs modifiés avec succès'
            : 'Rendez-vous modifié avec succès'
        );
      } else {
        await addAppointment.mutateAsync({
          dateHeure: timestamp,
          heureDebut: formData.heureDebut,
          heureFin: formData.heureFin,
          nomClient: formData.nomClient,
          referenceClient: formData.referenceClient,
          numeroTelephone: formData.numeroTelephone,
          adresse: formData.adresse,
          service: formData.service,
          notes: formData.notes,
          montantDu: montant,
          repetition,
        });
        toast.success('Rendez-vous ajouté avec succès');
      }
      onClose();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
      console.error(error);
    }
  };

  const handleDayToggle = (day: keyof JoursSemaine) => {
    setJoursSemaine(prev => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  const isLoading = addAppointment.isPending || updateAppointment.isPending;

  const daysOfWeek: { key: keyof JoursSemaine; label: string }[] = [
    { key: 'lundi', label: 'Lundi' },
    { key: 'mardi', label: 'Mardi' },
    { key: 'mercredi', label: 'Mercredi' },
    { key: 'jeudi', label: 'Jeudi' },
    { key: 'vendredi', label: 'Vendredi' },
    { key: 'samedi', label: 'Samedi' },
    { key: 'dimanche', label: 'Dimanche' },
  ];

  const selectedDaysCount = Object.values(joursSemaine).filter(Boolean).length;

  const selectedClient = selectedClientId
    ? clientRecords.find((c) => c.id.toString() === selectedClientId)
    : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {appointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          </DialogTitle>
          <DialogDescription>
            {appointment
              ? editMode === DemandeEdition.futursDuClient
                ? 'Modifiez tous les rendez-vous futurs pour ce client.'
                : 'Modifiez les informations du rendez-vous.'
              : 'Ajoutez un nouveau rendez-vous avec les détails du client.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="referenceClient" className="text-base font-semibold">Référence Client</Label>
            <Input
              id="referenceClient"
              placeholder="REF-2027-001"
              value={formData.referenceClient}
              onChange={(e) => setFormData({ ...formData, referenceClient: e.target.value })}
              className="border-2"
            />
            <p className="text-xs text-muted-foreground">
              Référence personnalisée pour identifier le client
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nomClient">Nom du client *</Label>
            <div className="flex gap-2">
              <Popover open={clientSelectOpen} onOpenChange={setClientSelectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientSelectOpen}
                    className="w-full justify-between"
                    type="button"
                  >
                    {selectedClient
                      ? `${selectedClient.clientName} (${selectedClient.referenceClient})`
                      : 'Sélectionner un client existant...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Rechercher un client..." />
                    <CommandList>
                      <CommandEmpty>Aucun client trouvé.</CommandEmpty>
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
            </div>
            <Input
              id="nomClient"
              placeholder="Ou saisir un nouveau nom..."
              value={formData.nomClient}
              onChange={(e) => {
                setFormData({ ...formData, nomClient: e.target.value });
                setSelectedClientId(null);
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="heureDebut">Heure de début *</Label>
              <Input
                id="heureDebut"
                type="time"
                value={formData.heureDebut}
                onChange={(e) => setFormData({ ...formData, heureDebut: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heureFin">Heure de fin *</Label>
              <Input
                id="heureFin"
                type="time"
                value={formData.heureFin}
                onChange={(e) => setFormData({ ...formData, heureFin: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numeroTelephone">Numéro de téléphone</Label>
            <Input
              id="numeroTelephone"
              placeholder="+33 6 12 34 56 78"
              value={formData.numeroTelephone}
              onChange={(e) => setFormData({ ...formData, numeroTelephone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adresse">Adresse</Label>
            <Input
              id="adresse"
              placeholder="123 Rue de la Paix, Paris"
              value={formData.adresse}
              onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Service *</Label>
            <Input
              id="service"
              placeholder="Consultation"
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Notes supplémentaires..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="montantDu">Montant dû *</Label>
            <Input
              id="montantDu"
              type="number"
              step="0.01"
              min="0"
              placeholder="50.00"
              value={formData.montantDu}
              onChange={(e) => setFormData({ ...formData, montantDu: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repetitionType">Type de répétition</Label>
            <Select
              value={formData.repetitionType}
              onValueChange={(value: RepetitionType) =>
                setFormData({ ...formData, repetitionType: value })
              }
            >
              <SelectTrigger id="repetitionType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aucune">Aucune répétition</SelectItem>
                <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                <SelectItem value="mensuelle">Mensuelle</SelectItem>
                <SelectItem value="annuelle">Annuelle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.repetitionType === 'hebdomadaire' && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Jours de la semaine
                  {selectedDaysCount > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({selectedDaysCount} jour{selectedDaysCount > 1 ? 's' : ''} sélectionné{selectedDaysCount > 1 ? 's' : ''})
                    </span>
                  )}
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {daysOfWeek.map(({ key, label }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={joursSemaine[key]}
                      onCheckedChange={() => handleDayToggle(key)}
                    />
                    <Label
                      htmlFor={key}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Le rendez-vous sera répété chaque semaine aux jours sélectionnés pendant 1 an
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
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
                'Ajouter'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
