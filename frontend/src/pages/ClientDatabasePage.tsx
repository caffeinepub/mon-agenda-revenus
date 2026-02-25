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
        { key: 'referenceClient', label: 'Référence' },
        { key: 'clientName', label: 'Nom' },
        { key: 'phoneNumber', label: 'Téléphone' },
        { key: 'address', label: 'Adresse' },
        { key: 'service', label: 'Service' },
        { key: 'notes', label: 'Notes' },
        { key: 'paidThisYear', label: 'Payé en 2026' },
      ]);

      downloadCsv(csvContent, 'clients-export.csv');
      toast.success('Export CSV réussi');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  if (clientsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="table-data text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <h1 className="frame-title text-3xl mb-8">Base de données clients</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="frame-title">
                {editingClientId ? 'Modifier le client' : 'Ajouter un client'}
              </CardTitle>
              <CardDescription className="table-data">
                {editingClientId
                  ? 'Modifiez les informations du client sélectionné'
                  : 'Remplissez le formulaire pour ajouter un nouveau client'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="clientName" className="table-header">Nom du client *</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    required
                    className="table-data"
                  />
                </div>

                <div>
                  <Label htmlFor="referenceClient" className="table-header">Référence client *</Label>
                  <Input
                    id="referenceClient"
                    value={formData.referenceClient}
                    onChange={(e) => setFormData({ ...formData, referenceClient: e.target.value })}
                    required
                    disabled={!!editingClientId}
                    className="table-data"
                  />
                  {editingClientId && (
                    <p className="table-data text-muted-foreground mt-1">
                      La référence ne peut pas être modifiée
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phoneNumber" className="table-header">Téléphone</Label>
                  <Input
                    id="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="table-data"
                  />
                </div>

                <div>
                  <Label htmlFor="address" className="table-header">Adresse</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="table-data"
                  />
                </div>

                <div>
                  <Label htmlFor="service" className="table-header">Service</Label>
                  <Input
                    id="service"
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    className="table-data"
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="table-header">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="table-data"
                  />
                </div>

                <ClientPhotoField
                  value={formData.photo}
                  onChange={(photo) => setFormData({ ...formData, photo })}
                />

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 table-data">
                    <Save className="h-4 w-4 mr-2" />
                    {editingClientId ? 'Mettre à jour' : 'Ajouter'}
                  </Button>
                  {editingClientId && (
                    <Button type="button" variant="outline" onClick={resetForm} className="table-data">
                      <X className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Table Section */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="frame-title">Liste des clients</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortAlphabetically(!sortAlphabetically)}
                    className="table-data"
                  >
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    {sortAlphabetically ? 'Ordre original' : 'Tri A-Z'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    disabled={sortedClients.length === 0}
                    className="table-data"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="table-header">Photo</TableHead>
                      <TableHead className="table-header">Nom</TableHead>
                      <TableHead className="table-header">Référence</TableHead>
                      <TableHead className="table-header">Téléphone</TableHead>
                      <TableHead className="table-header">Adresse</TableHead>
                      <TableHead className="table-header">Service</TableHead>
                      <TableHead className="table-header">Notes</TableHead>
                      <TableHead className="text-right table-header">Payé en 2026</TableHead>
                      <TableHead className="table-header">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center table-data text-muted-foreground">
                          Aucun client enregistré
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedClients.map((client) => (
                        <TableRow
                          key={client.id.toString()}
                          className={editingClientId === client.id ? 'bg-muted/50' : ''}
                        >
                          <TableCell className="table-data">
                            {client.photo ? (
                              <img
                                src={photoToUrl(client.photo)}
                                alt={client.clientName}
                                className="w-10 h-12 object-cover rounded"
                              />
                            ) : (
                              <div className="w-10 h-12 bg-muted rounded flex items-center justify-center table-data">
                                -
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="table-data">{client.clientName}</TableCell>
                          <TableCell className="table-data">{client.referenceClient}</TableCell>
                          <TableCell className="table-data">{client.phoneNumber || '-'}</TableCell>
                          <TableCell className="table-data">{client.address || '-'}</TableCell>
                          <TableCell className="table-data">{client.service || '-'}</TableCell>
                          <TableCell className="table-data max-w-xs truncate" title={client.notes}>
                            {client.notes || '-'}
                          </TableCell>
                          <TableCell className="text-right table-data">
                            {calculatePaidThisYear(client.referenceClient).toLocaleString('fr-FR')}
                          </TableCell>
                          <TableCell className="table-data">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClientSelect(client)}
                                className="table-data"
                              >
                                Modifier
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteClick(client.id)}
                                className="table-data"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="frame-title">Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription className="table-data">
              Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="table-data">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="table-data">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
