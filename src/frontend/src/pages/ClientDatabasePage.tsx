import { useState, useMemo } from 'react';
import {
  useGetAllClientRecords,
  useAddClientRecord,
  useUpdateClientRecord,
  useDeleteClientRecord,
  useGetAllAppointments,
} from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Trash2, Save, X, Download, ArrowUpDown } from 'lucide-react';
import ClientPhotoField from '../components/ClientPhotoField';
import { photoToUrl } from '../utils/imageCrop';
import { arrayToCsv, downloadCsv } from '../utils/csvExport';
import type { ClientRecord } from '../backend';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ClientDatabasePage() {
  const { identity } = useInternetIdentity();
  const { data: clients = [], isLoading: clientsLoading } = useGetAllClientRecords();
  const { data: appointments = [] } = useGetAllAppointments();
  const addClient = useAddClientRecord();
  const updateClient = useUpdateClientRecord();
  const deleteClient = useDeleteClientRecord();

  const [formData, setFormData] = useState({
    clientName: '',
    referenceClient: '',
    phoneNumber: '',
    address: '',
    service: '',
    notes: '',
    photo: null as Uint8Array | null,
  });

  const [editingClientId, setEditingClientId] = useState<bigint | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<bigint | null>(null);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);

  const resetForm = () => {
    setFormData({
      clientName: '',
      referenceClient: '',
      phoneNumber: '',
      address: '',
      service: '',
      notes: '',
      photo: null,
    });
    setEditingClientId(null);
  };

  const handleClientSelect = (client: ClientRecord) => {
    setFormData({
      clientName: client.clientName,
      referenceClient: client.referenceClient,
      phoneNumber: client.phoneNumber,
      address: client.address,
      service: client.service,
      notes: client.notes,
      photo: client.photo ? new Uint8Array(client.photo) : null,
    });
    setEditingClientId(client.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientName || !formData.referenceClient) {
      toast.error('Veuillez remplir le nom et la référence client');
      return;
    }

    // Check if actor is ready
    if (!identity) {
      toast.error('Veuillez vous connecter pour enregistrer un client');
      return;
    }

    try {
      if (editingClientId) {
        await updateClient.mutateAsync({
          id: editingClientId,
          clientName: formData.clientName,
          referenceClient: formData.referenceClient,
          phoneNumber: formData.phoneNumber,
          address: formData.address,
          service: formData.service,
          notes: formData.notes,
          photo: formData.photo,
        });
        toast.success('Client modifié avec succès');
      } else {
        await addClient.mutateAsync({
          clientName: formData.clientName,
          referenceClient: formData.referenceClient,
          phoneNumber: formData.phoneNumber,
          address: formData.address,
          service: formData.service,
          notes: formData.notes,
          photo: formData.photo,
        });
        toast.success('Client ajouté avec succès');
      }
      resetForm();
    } catch (error: any) {
      console.error('Error saving client:', error);
      
      // Parse authorization errors
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('Non autorisé') || errorMessage.includes('Unauthorized') || errorMessage.includes('not authorized')) {
        toast.error('Non autorisé : Veuillez vous reconnecter et réessayer');
      } else {
        toast.error(errorMessage || 'Erreur lors de l\'enregistrement');
      }
    }
  };

  const handleDeleteClick = (clientId: bigint) => {
    setClientToDelete(clientId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;

    try {
      await deleteClient.mutateAsync(clientToDelete);
      toast.success('Client supprimé avec succès');
      if (editingClientId === clientToDelete) {
        resetForm();
      }
    } catch (error: any) {
      console.error('Error deleting client:', error);
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('Non autorisé') || errorMessage.includes('Unauthorized') || errorMessage.includes('not authorized')) {
        toast.error('Non autorisé : Vous ne pouvez supprimer que vos propres clients');
      } else {
        toast.error(errorMessage || 'Erreur lors de la suppression');
      }
    } finally {
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  // Calculate paid this year for each client
  const calculatePaidThisYear = (referenceClient: string): number => {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime() * 1000000;
    const endOfYear = new Date(currentYear + 1, 0, 1).getTime() * 1000000;

    let total = 0;
    appointments.forEach((apt) => {
      if (
        apt.referenceClient === referenceClient &&
        Number(apt.dateHeure) >= startOfYear &&
        Number(apt.dateHeure) < endOfYear
      ) {
        total += Number(apt.montantPaye);
      }
    });

    return total;
  };

  // Sort clients alphabetically by name if enabled
  const sortedClients = useMemo(() => {
    if (!sortAlphabetically) {
      return clients;
    }
    return [...clients].sort((a, b) => 
      a.clientName.localeCompare(b.clientName, 'fr', { sensitivity: 'base' })
    );
  }, [clients, sortAlphabetically]);

  // Export clients to CSV
  const handleExportCsv = () => {
    if (sortedClients.length === 0) {
      toast.error('Aucun client à exporter');
      return;
    }

    try {
      const exportData = sortedClients.map(client => ({
        referenceClient: client.referenceClient,
        clientName: client.clientName,
        phoneNumber: client.phoneNumber || '',
        address: client.address || '',
        service: client.service || '',
        notes: client.notes || '',
        paidThisYear: calculatePaidThisYear(client.referenceClient),
      }));

      const csvContent = arrayToCsv(exportData, [
        { key: 'referenceClient', label: 'Référence Client' },
        { key: 'clientName', label: 'Nom' },
        { key: 'phoneNumber', label: 'Téléphone' },
        { key: 'address', label: 'Adresse' },
        { key: 'service', label: 'Service' },
        { key: 'notes', label: 'Notes' },
        { key: 'paidThisYear', label: 'Payé cette année' },
      ]);

      const timestamp = new Date().toISOString().split('T')[0];
      downloadCsv(csvContent, `base-client-${timestamp}.csv`);
      
      toast.success('Export CSV réussi');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const isLoading = addClient.isPending || updateClient.isPending || deleteClient.isPending;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Base Client</h1>
          <p className="text-muted-foreground">
            Gérez vos clients et consultez leurs informations
          </p>
        </div>
      </div>

      {/* Client Form */}
      <Card>
        <CardHeader>
          <CardTitle>{editingClientId ? 'Modifier le client' : 'Nouveau client'}</CardTitle>
          <CardDescription>
            {editingClientId
              ? 'Modifiez les informations du client sélectionné'
              : 'Ajoutez un nouveau client à votre base'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  disabled={isLoading || !!editingClientId}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientName">Nom *</Label>
                <Input
                  id="clientName"
                  placeholder="Jean Dupont"
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData({ ...formData, clientName: e.target.value })
                  }
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Numéro de téléphone</Label>
                <Input
                  id="phoneNumber"
                  placeholder="+33 6 12 34 56 78"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  placeholder="123 Rue de la Paix, Paris"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
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

            <ClientPhotoField
              value={formData.photo}
              onChange={(photo) => setFormData({ ...formData, photo })}
              disabled={isLoading}
            />

            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editingClientId ? 'Modifier' : 'Ajouter'}
                  </>
                )}
              </Button>
              {editingClientId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Annuler
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Liste des clients</CardTitle>
              <CardDescription>
                Cliquez sur une ligne pour modifier un client
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSortAlphabetically(!sortAlphabetically)}
                className="gap-2"
                disabled={clientsLoading || clients.length === 0}
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortAlphabetically ? 'Ordre original' : 'Trier A-Z'}
              </Button>
              <Button
                variant="outline"
                onClick={handleExportCsv}
                className="gap-2"
                disabled={clientsLoading || clients.length === 0}
              >
                <Download className="h-4 w-4" />
                Exporter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clientsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : sortedClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun client enregistré
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Photo</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Adresse</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Payé cette année</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedClients.map((client) => {
                    const paidThisYear = calculatePaidThisYear(client.referenceClient);
                    return (
                      <TableRow
                        key={client.id.toString()}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleClientSelect(client)}
                      >
                        <TableCell>
                          {client.photo ? (
                            <img
                              src={photoToUrl(client.photo)}
                              alt={client.clientName}
                              className="w-10 h-12 object-cover rounded border"
                              style={{ aspectRatio: '35/45' }}
                            />
                          ) : (
                            <div className="w-10 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                              Aucune
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {client.referenceClient}
                        </TableCell>
                        <TableCell>{client.clientName}</TableCell>
                        <TableCell>{client.phoneNumber || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {client.address || '-'}
                        </TableCell>
                        <TableCell>{client.service || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {client.notes || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {paidThisYear.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(client.id);
                            }}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
