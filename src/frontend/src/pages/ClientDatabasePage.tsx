import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUpDown,
  Download,
  Edit,
  FileCode,
  Save,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { ClientRecord } from "../backend";
import ClientPhotoField from "../components/ClientPhotoField";
import {
  useAddClientRecord,
  useDeleteClientRecord,
  useGetAllAppointments,
  useGetAllClientRecords,
  useUpdateClientRecord,
} from "../hooks/useQueries";
import { arrayToCsv, downloadCsv } from "../utils/csvExport";
import { photoToUrl } from "../utils/imageCrop";

// ── localStorage helpers for extra client fields ──────────────────────────
const AGENDA_CLIENT_EXTRA_FIELDS_KEY = "agenda_client_extra_fields";

interface ClientExtraFields {
  prenom: string;
  courriel1: string;
  courriel2: string;
  dateNaissance: string;
  nomSecondContact: string;
  telephoneSecondContact: string;
}

const emptyExtraFields = (): ClientExtraFields => ({
  prenom: "",
  courriel1: "",
  courriel2: "",
  dateNaissance: "",
  nomSecondContact: "",
  telephoneSecondContact: "",
});

function loadExtraFields(ref: string): ClientExtraFields {
  try {
    const raw = localStorage.getItem(AGENDA_CLIENT_EXTRA_FIELDS_KEY);
    if (!raw) return emptyExtraFields();
    const all = JSON.parse(raw) as Record<string, ClientExtraFields>;
    return all[ref] ?? emptyExtraFields();
  } catch {
    return emptyExtraFields();
  }
}

function saveExtraFields(ref: string, fields: ClientExtraFields): void {
  try {
    const raw = localStorage.getItem(AGENDA_CLIENT_EXTRA_FIELDS_KEY);
    const all: Record<string, ClientExtraFields> = raw ? JSON.parse(raw) : {};
    all[ref] = fields;
    localStorage.setItem(AGENDA_CLIENT_EXTRA_FIELDS_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

// ── Mode du panneau gauche ──────────────────────────────────────────
type PanelMode = "form" | "search" | "fiche";

export default function ClientDatabasePage() {
  const { data: clients = [], isLoading: clientsLoading } =
    useGetAllClientRecords();
  const { data: appointments = [] } = useGetAllAppointments();
  const addClient = useAddClientRecord();
  const updateClient = useUpdateClientRecord();
  const deleteClient = useDeleteClientRecord();

  // ── Mode panneau gauche ──
  const [panelMode, setPanelMode] = useState<PanelMode>("form");

  // ── Formulaire ──
  const [formData, setFormData] = useState({
    clientName: "",
    referenceClient: "",
    phoneNumber: "",
    address: "",
    service: "",
    notes: "",
    photo: null as Uint8Array | null,
  });

  const [editingClientId, setEditingClientId] = useState<bigint | null>(null);
  const [extraFields, setExtraFields] = useState<ClientExtraFields>(
    emptyExtraFields(),
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<bigint | null>(null);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);

  // ── All extra fields for Prénom display ──
  const [allExtraFields, setAllExtraFields] = useState<
    Record<string, { prenom?: string }>
  >(() => {
    try {
      const raw = localStorage.getItem(AGENDA_CLIENT_EXTRA_FIELDS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Reload allExtraFields when needed
  const reloadAllExtraFields = () => {
    try {
      const raw = localStorage.getItem(AGENDA_CLIENT_EXTRA_FIELDS_KEY);
      setAllExtraFields(raw ? JSON.parse(raw) : {});
    } catch {
      setAllExtraFields({});
    }
  };

  // ── Recherche ──
  const [searchName, setSearchName] = useState("");
  const [searchPrenom, setSearchPrenom] = useState("");
  const [searchRef, setSearchRef] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [searchService, setSearchService] = useState("");
  const [searchResults, setSearchResults] = useState<ClientRecord[] | null>(
    null,
  );

  // ── Fiche client ──
  const [ficheClient, setFicheClient] = useState<ClientRecord | null>(null);

  // ── Calculs rendez-vous pour la fiche ──
  const ficheStats = useMemo(() => {
    if (!ficheClient) return null;
    const currentYear = new Date().getFullYear();
    const now = BigInt(Date.now()) * BigInt(1_000_000);
    const startOfYear =
      BigInt(new Date(currentYear, 0, 1).getTime()) * BigInt(1_000_000);
    const endOfYear =
      BigInt(new Date(currentYear + 1, 0, 1).getTime()) * BigInt(1_000_000);

    const clientApts = appointments.filter(
      (apt) =>
        apt.referenceClient === ficheClient.referenceClient &&
        apt.dateHeure >= startOfYear &&
        apt.dateHeure < endOfYear,
    );

    // Point 1: Only show present and past appointments (not future)
    const pastPresentApts = clientApts.filter((apt) => apt.dateHeure <= now);

    // Nb de RDV = uniquement ceux cochés "Fait" (parmi présent/passé)
    const totalRdv = pastPresentApts.filter((a) => a.fait).length;
    const totalPaye = pastPresentApts.reduce(
      (s, a) => s + Number(a.montantPaye),
      0,
    );
    const totalDuFaits = pastPresentApts
      .filter((a) => a.fait)
      .reduce((s, a) => s + Number(a.montantDu), 0);
    const totalImpaye = Math.max(0, totalDuFaits - totalPaye);
    // Crédit = total Payé - somme des Dû des lignes cochées "Fait"
    const totalCredit = totalPaye - totalDuFaits;

    // Liste des RDV triés par date (présent/passé seulement)
    const rdvList = [...pastPresentApts].sort(
      (a, b) => Number(a.dateHeure) - Number(b.dateHeure),
    );

    return {
      totalRdv,
      totalPaye,
      totalDu: totalDuFaits,
      totalImpaye,
      totalCredit,
      rdvList,
    };
  }, [ficheClient, appointments]);

  const generateClientRef = (): string => {
    const year = new Date().getFullYear();
    let n = clients.length + 1;
    let ref = `CLI-${year}-${String(n).padStart(3, "0")}`;
    const existingRefs = new Set(clients.map((c) => c.referenceClient));
    while (existingRefs.has(ref)) {
      n++;
      ref = `CLI-${year}-${String(n).padStart(3, "0")}`;
    }
    return ref;
  };

  const resetForm = () => {
    setFormData({
      clientName: "",
      referenceClient: generateClientRef(),
      phoneNumber: "",
      address: "",
      service: "",
      notes: "",
      photo: null,
    });
    setExtraFields(emptyExtraFields());
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
    setExtraFields(loadExtraFields(client.referenceClient));
    setEditingClientId(client.id);
    setPanelMode("form");
  };

  const handleViewFiche = (client: ClientRecord) => {
    setFicheClient(client);
    setPanelMode("fiche");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.referenceClient) {
      toast.error("Veuillez remplir la référence client");
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
        saveExtraFields(formData.referenceClient, extraFields);
        reloadAllExtraFields();
        toast.success("Client modifié avec succès");
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
        saveExtraFields(formData.referenceClient, extraFields);
        reloadAllExtraFields();
        toast.success("Client ajouté avec succès");
      }
      resetForm();
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes("Non autorisé") ||
        errorMessage.includes("Unauthorized") ||
        errorMessage.includes("not authorized")
      ) {
        toast.error("Non autorisé : Veuillez vous reconnecter et réessayer");
      } else {
        toast.error(errorMessage || "Erreur lors de l'enregistrement");
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
      toast.success("Client supprimé avec succès");
      if (editingClientId === clientToDelete) {
        resetForm();
      }
      if (ficheClient?.id === clientToDelete) {
        setFicheClient(null);
        setPanelMode("form");
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes("Non autorisé") ||
        errorMessage.includes("Unauthorized") ||
        errorMessage.includes("not authorized")
      ) {
        toast.error(
          "Non autorisé : Vous ne pouvez supprimer que vos propres clients",
        );
      } else {
        toast.error(errorMessage || "Erreur lors de la suppression");
      }
    } finally {
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  // ── Calcul total payé pour l'année courante ──
  const calculatePaidThisYear = (referenceClient: string): number => {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime() * 1_000_000;
    const endOfYear = new Date(currentYear + 1, 0, 1).getTime() * 1_000_000;

    let total = 0;
    for (const apt of appointments) {
      if (
        apt.referenceClient === referenceClient &&
        Number(apt.dateHeure) >= startOfYear &&
        Number(apt.dateHeure) < endOfYear
      ) {
        total += Number(apt.montantPaye);
      }
    }
    return total;
  };

  // ── Recherche multi-critères ──
  const handleSearch = () => {
    const name = searchName.trim().toLowerCase();
    const prenom = searchPrenom.trim().toLowerCase();
    const ref = searchRef.trim().toLowerCase();
    const phone = searchPhone.trim().toLowerCase();
    const service = searchService.trim().toLowerCase();

    if (!name && !prenom && !ref && !phone && !service) {
      toast.error("Veuillez saisir au moins un critère de recherche");
      return;
    }

    const results = clients.filter((c) => {
      const matchName = !name || c.clientName.toLowerCase().includes(name);
      const matchPrenom =
        !prenom ||
        (allExtraFields[c.referenceClient]?.prenom || "")
          .toLowerCase()
          .includes(prenom);
      const matchRef = !ref || c.referenceClient.toLowerCase().includes(ref);
      const matchPhone = !phone || c.phoneNumber.toLowerCase().includes(phone);
      const matchService =
        !service || c.service.toLowerCase().includes(service);
      return matchName && matchPrenom && matchRef && matchPhone && matchService;
    });

    setSearchResults(results);
  };

  const handleResetSearch = () => {
    setSearchName("");
    setSearchPrenom("");
    setSearchRef("");
    setSearchPhone("");
    setSearchService("");
    setSearchResults(null);
  };

  // ── Tri alphabétique ──
  const sortedClients = useMemo(() => {
    if (!sortAlphabetically) return clients;
    return [...clients].sort((a, b) =>
      a.clientName.localeCompare(b.clientName, "fr", { sensitivity: "base" }),
    );
  }, [clients, sortAlphabetically]);

  // ── Export HTML ──
  const handleExportHtml = () => {
    if (sortedClients.length === 0) {
      toast.error("Aucun client à exporter");
      return;
    }
    try {
      const currentYear = new Date().getFullYear();
      const rows = sortedClients
        .map((client) => {
          const paid = calculatePaidThisYear(client.referenceClient);
          return `
          <tr>
            <td>${client.referenceClient}</td>
            <td>${client.clientName}</td>
            <td>${client.phoneNumber || ""}</td>
            <td>${client.address || ""}</td>
            <td>${client.service || ""}</td>
            <td>${client.notes || ""}</td>
            <td style="text-align:right">${paid.toLocaleString("fr-FR")}</td>
          </tr>`;
        })
        .join("");

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Base Clients ${currentYear}</title>
  <style>
    body { font-family: Verdana, sans-serif; font-size: 11px; margin: 20px; }
    h1 { font-size: 14px; font-weight: bold; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #e0e0e0; font-size: 10px; font-weight: bold; padding: 4px 8px; text-align: left; border: 1px solid #ccc; }
    td { font-size: 9px; padding: 3px 8px; border: 1px solid #ddd; }
    tr:nth-child(even) td { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Base Clients ${currentYear}</h1>
  <table>
    <thead>
      <tr>
        <th>Référence</th>
        <th>Nom</th>
        <th>Téléphone</th>
        <th>Adresse</th>
        <th>Service</th>
        <th>Notes</th>
        <th>Payé en ${currentYear}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clients-export-${currentYear}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export HTML réussi");
    } catch {
      toast.error("Erreur lors de l'export HTML");
    }
  };

  // ── Export HTML Fiche Client ──
  const handleExportFicheHtml = () => {
    if (!ficheClient || !ficheStats) {
      toast.error("Aucune fiche client à exporter");
      return;
    }
    try {
      const currentYear = new Date().getFullYear();
      const exportPaymentDates: Map<string, string> = (() => {
        try {
          const raw = localStorage.getItem("weekly_payment_dates");
          return raw
            ? new Map<string, string>(JSON.parse(raw))
            : new Map<string, string>();
        } catch {
          return new Map<string, string>();
        }
      })();
      const rdvRows = ficheStats.rdvList
        .map((apt, idx) => {
          const d = new Date(Number(apt.dateHeure) / 1_000_000);
          const dateStr = d.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          const faitLabel = apt.annule ? "Annulé" : apt.fait ? "✓" : "-";
          const ligneCredit = apt.fait
            ? Number(apt.montantPaye) - Number(apt.montantDu)
            : Number(apt.montantPaye);
          const bg = idx % 2 === 0 ? "#ffffff" : "#f2f2f2";
          const faitColor = apt.annule ? "#c0392b" : "inherit";
          const creditColor = ligneCredit >= 0 ? "#27ae60" : "#c0392b";
          const payDate = exportPaymentDates.get(apt.id.toString()) ?? "";
          return `<tr style="background:${bg}">
            <td>${dateStr}</td>
            <td style="text-align:right">${Number(apt.montantDu).toLocaleString("fr-FR")}</td>
            <td style="text-align:right">${Number(apt.montantPaye).toLocaleString("fr-FR")}</td>
            <td style="text-align:left">${payDate}</td>
            <td style="text-align:left">${apt.commentaireManuel || ""}</td>
            <td style="text-align:center;color:${faitColor};font-style:${apt.annule ? "italic" : "normal"}">${faitLabel}</td>
            <td style="text-align:right;color:${creditColor}">${ligneCredit.toLocaleString("fr-FR")}</td>
          </tr>`;
        })
        .join("");

      const totalCreditColor =
        ficheStats.totalCredit >= 0 ? "#27ae60" : "#c0392b";
      const imapyeColor = ficheStats.totalImpaye > 0 ? "#c0392b" : "#27ae60";

      const photoHtml = ficheClient.photo
        ? `<img src="${photoToUrl(ficheClient.photo)}" alt="${ficheClient.clientName}" style="width:100px;height:129px;object-fit:cover;border-radius:4px;margin-bottom:12px;" /><br/>`
        : "";

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Fiche Client - ${ficheClient.clientName} - ${currentYear}</title>
  <style>
    body { font-family: Verdana, sans-serif; font-size: 11px; margin: 20px; }
    h1 { font-size: 14px; font-weight: bold; margin-bottom: 16px; }
    h2 { font-size: 12px; font-weight: bold; margin: 16px 0 8px 0; }
    .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; margin-bottom: 12px; }
    .info-label { font-weight: bold; font-size: 10px; color: #555; }
    .info-value { font-size: 10px; }
    .resume { background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-bottom: 12px; }
    .resume-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 12px; }
    .resume-label { font-size: 9px; color: #777; }
    .resume-value { font-size: 9px; font-weight: bold; text-align: right; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th { background: #e8e8e8; font-size: 10px; font-weight: bold; padding: 3px 4px; border: 1px solid #ccc; }
    td { font-size: 9px; padding: 2px 4px; border: 1px solid #ddd; }
    .total-row { background: #d8eaff; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Fiche Client - ${currentYear}</h1>
  ${photoHtml}
  <div class="info-grid">
    <span class="info-label">Nom</span><span class="info-value">${ficheClient.clientName}</span>
    <span class="info-label">Référence</span><span class="info-value">${ficheClient.referenceClient}</span>
    ${ficheClient.phoneNumber ? `<span class="info-label">Téléphone</span><span class="info-value">${ficheClient.phoneNumber}</span>` : ""}
    ${ficheClient.address ? `<span class="info-label">Adresse</span><span class="info-value">${ficheClient.address}</span>` : ""}
    ${ficheClient.service ? `<span class="info-label">Service</span><span class="info-value">${ficheClient.service}</span>` : ""}
    ${ficheClient.notes ? `<span class="info-label">Notes</span><span class="info-value">${ficheClient.notes}</span>` : ""}
  </div>
  <div class="resume">
    <div style="font-weight:bold;font-size:12px;margin-bottom:8px;">Résumé ${currentYear}</div>
    <div class="resume-grid">
      <span class="resume-label">Nb de RDV (faits)</span><span class="resume-value">${ficheStats.totalRdv}</span>
      <span class="resume-label">Total payé</span><span class="resume-value" style="color:#27ae60">${ficheStats.totalPaye.toLocaleString("fr-FR")}</span>
      <span class="resume-label">Total dû (faits)</span><span class="resume-value" style="color:#2756ae">${ficheStats.totalDu.toLocaleString("fr-FR")}</span>
      <span class="resume-label">Montant impayé</span><span class="resume-value" style="color:${imapyeColor}">${ficheStats.totalImpaye.toLocaleString("fr-FR")}</span>
    </div>
  </div>
  <h2>Rendez-vous ${currentYear}</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Date</th>
        <th style="text-align:right">Dû</th>
        <th style="text-align:right">Payé</th>
        <th style="text-align:left">Date</th>
        <th style="text-align:left">Note</th>
        <th style="text-align:center">Fait</th>
        <th style="text-align:right">Crédit</th>
      </tr>
    </thead>
    <tbody>
      <tr class="total-row">
        <td>Total</td>
        <td style="text-align:right">${ficheStats.totalDu.toLocaleString("fr-FR")}</td>
        <td style="text-align:right">${ficheStats.totalPaye.toLocaleString("fr-FR")}</td>
        <td style="text-align:left">—</td>
        <td style="text-align:left">—</td>
        <td style="text-align:center">—</td>
        <td style="text-align:right;color:${totalCreditColor}">${ficheStats.totalCredit.toLocaleString("fr-FR")}</td>
      </tr>
      ${rdvRows}
    </tbody>
  </table>
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fiche-client-${ficheClient.referenceClient}-${currentYear}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Fiche client exportée en HTML");
    } catch {
      toast.error("Erreur lors de l'export HTML");
    }
  };

  // ── Export CSV ──
  const handleExportCsv = () => {
    if (sortedClients.length === 0) {
      toast.error("Aucun client à exporter");
      return;
    }
    try {
      const exportData = sortedClients.map((client) => ({
        referenceClient: client.referenceClient,
        clientName: client.clientName,
        phoneNumber: client.phoneNumber || "",
        address: client.address || "",
        service: client.service || "",
        notes: client.notes || "",
        paidThisYear: calculatePaidThisYear(client.referenceClient),
      }));
      const csvContent = arrayToCsv(exportData, [
        { key: "referenceClient", label: "Référence" },
        { key: "clientName", label: "Nom" },
        { key: "phoneNumber", label: "Téléphone" },
        { key: "address", label: "Adresse" },
        { key: "service", label: "Service" },
        { key: "notes", label: "Notes" },
        { key: "paidThisYear", label: "Payé en 2026" },
      ]);
      downloadCsv(csvContent, "clients-export.csv");
      toast.success("Export CSV réussi");
    } catch {
      toast.error("Erreur lors de l'export CSV");
    }
  };

  if (clientsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="table-data text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  // ── Panneau gauche : FICHE CLIENT ──
  const renderFichePanel = () => {
    if (!ficheClient || !ficheStats) return null;
    const currentYear = new Date().getFullYear();
    const paymentDatesMap: Map<string, string> = (() => {
      try {
        const raw = localStorage.getItem("weekly_payment_dates");
        return raw
          ? new Map<string, string>(JSON.parse(raw))
          : new Map<string, string>();
      } catch {
        return new Map<string, string>();
      }
    })();
    return (
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="frame-title">Fiche client</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportFicheHtml}
                className="table-data"
                data-ocid="client.fiche.export_html.button"
              >
                <FileCode className="h-4 w-4 mr-1" />
                Exporter en HTML
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClientSelect(ficheClient)}
                className="table-data"
                data-ocid="client.fiche.edit_button"
              >
                <Edit className="h-4 w-4 mr-1" />
                Modifier
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFicheClient(null);
                  setPanelMode("form");
                }}
                className="table-data"
                data-ocid="client.fiche.close_button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Photo */}
          {ficheClient.photo && (
            <div className="flex justify-center mb-2">
              <img
                src={photoToUrl(ficheClient.photo)}
                alt={ficheClient.clientName}
                className="rounded"
                style={{ width: "100px", height: "129px", objectFit: "cover" }}
              />
            </div>
          )}

          {/* Identité */}
          <div>
            <p
              className="table-header font-bold"
              style={{ fontFamily: "Verdana, sans-serif", fontSize: "12px" }}
            >
              Nom
            </p>
            <p className="table-data">{ficheClient.clientName}</p>
          </div>
          {(() => {
            const extras = loadExtraFields(ficheClient.referenceClient);
            return extras.prenom ? (
              <div>
                <p
                  className="table-header font-bold"
                  style={{
                    fontFamily: "Verdana, sans-serif",
                    fontSize: "12px",
                  }}
                >
                  Prénom
                </p>
                <p className="table-data">{extras.prenom}</p>
              </div>
            ) : null;
          })()}
          <div>
            <p
              className="table-header font-bold"
              style={{ fontFamily: "Verdana, sans-serif", fontSize: "12px" }}
            >
              Référence
            </p>
            <p className="table-data">{ficheClient.referenceClient}</p>
          </div>
          {ficheClient.phoneNumber && (
            <div>
              <p
                className="table-header font-bold"
                style={{ fontFamily: "Verdana, sans-serif", fontSize: "12px" }}
              >
                Téléphone
              </p>
              <p className="table-data">{ficheClient.phoneNumber}</p>
            </div>
          )}
          {ficheClient.address && (
            <div>
              <p
                className="table-header font-bold"
                style={{ fontFamily: "Verdana, sans-serif", fontSize: "12px" }}
              >
                Adresse
              </p>
              <p className="table-data">{ficheClient.address}</p>
            </div>
          )}
          {ficheClient.service && (
            <div>
              <p
                className="table-header font-bold"
                style={{ fontFamily: "Verdana, sans-serif", fontSize: "12px" }}
              >
                Service
              </p>
              <p className="table-data">{ficheClient.service}</p>
            </div>
          )}
          {ficheClient.notes && (
            <div>
              <p
                className="table-header font-bold"
                style={{ fontFamily: "Verdana, sans-serif", fontSize: "12px" }}
              >
                Notes
              </p>
              <p className="table-data">{ficheClient.notes}</p>
            </div>
          )}

          {/* Extra fields from localStorage */}
          {(() => {
            const extras = loadExtraFields(ficheClient.referenceClient);
            return (
              <>
                {extras.courriel1 && (
                  <div>
                    <p
                      className="table-header font-bold"
                      style={{
                        fontFamily: "Verdana, sans-serif",
                        fontSize: "12px",
                      }}
                    >
                      Courriel 1
                    </p>
                    <p className="table-data">{extras.courriel1}</p>
                  </div>
                )}
                {extras.courriel2 && (
                  <div>
                    <p
                      className="table-header font-bold"
                      style={{
                        fontFamily: "Verdana, sans-serif",
                        fontSize: "12px",
                      }}
                    >
                      Courriel 2
                    </p>
                    <p className="table-data">{extras.courriel2}</p>
                  </div>
                )}
                {extras.dateNaissance && (
                  <div>
                    <p
                      className="table-header font-bold"
                      style={{
                        fontFamily: "Verdana, sans-serif",
                        fontSize: "12px",
                      }}
                    >
                      Date de naissance
                    </p>
                    <p className="table-data">{extras.dateNaissance}</p>
                  </div>
                )}
                {extras.nomSecondContact && (
                  <div>
                    <p
                      className="table-header font-bold"
                      style={{
                        fontFamily: "Verdana, sans-serif",
                        fontSize: "12px",
                      }}
                    >
                      Nom Second contact
                    </p>
                    <p className="table-data">{extras.nomSecondContact}</p>
                  </div>
                )}
                {extras.telephoneSecondContact && (
                  <div>
                    <p
                      className="table-header font-bold"
                      style={{
                        fontFamily: "Verdana, sans-serif",
                        fontSize: "12px",
                      }}
                    >
                      Téléphone second contact
                    </p>
                    <p className="table-data">
                      {extras.telephoneSecondContact}
                    </p>
                  </div>
                )}
              </>
            );
          })()}

          {/* Résumé RDV */}
          <div
            className="rounded border mt-2"
            style={{ background: "#f8f8f8", padding: "10px" }}
          >
            <p
              className="font-bold mb-2"
              style={{ fontFamily: "Verdana, sans-serif", fontSize: "12px" }}
            >
              Résumé {currentYear}
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <p className="table-data text-muted-foreground">Nb de RDV</p>
              <p className="table-data font-bold text-right">
                {ficheStats.totalRdv}
              </p>

              <p className="table-data text-muted-foreground">Total payé</p>
              <p className="table-data font-bold text-right text-green-700">
                {ficheStats.totalPaye.toLocaleString("fr-FR")}
              </p>

              <p className="table-data text-muted-foreground">
                Total dû (faits)
              </p>
              <p className="table-data font-bold text-right text-blue-700">
                {ficheStats.totalDu.toLocaleString("fr-FR")}
              </p>

              <p className="table-data text-muted-foreground">Montant impayé</p>
              <p
                className="table-data font-bold text-right"
                style={{
                  color: ficheStats.totalImpaye > 0 ? "#c0392b" : "#27ae60",
                }}
              >
                {ficheStats.totalImpaye.toLocaleString("fr-FR")}
              </p>
            </div>
          </div>

          {/* Liste des RDV */}
          {ficheStats.rdvList.length > 0 && (
            <div className="mt-2">
              <p
                className="font-bold mb-1"
                style={{ fontFamily: "Verdana, sans-serif", fontSize: "12px" }}
              >
                Rendez-vous {currentYear}
              </p>
              <div className="overflow-y-auto" style={{ maxHeight: "200px" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "9px",
                    fontFamily: "Verdana, sans-serif",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#e8e8e8" }}>
                      <th
                        style={{
                          padding: "3px 4px",
                          textAlign: "left",
                          fontWeight: "bold",
                          fontSize: "10px",
                        }}
                      >
                        Date
                      </th>
                      <th
                        style={{
                          padding: "3px 4px",
                          textAlign: "right",
                          fontWeight: "bold",
                          fontSize: "10px",
                        }}
                      >
                        Dû
                      </th>
                      <th
                        style={{
                          padding: "3px 4px",
                          textAlign: "right",
                          fontWeight: "bold",
                          fontSize: "10px",
                        }}
                      >
                        Payé
                      </th>
                      <th
                        style={{
                          padding: "3px 4px",
                          textAlign: "left",
                          fontWeight: "bold",
                          fontSize: "10px",
                        }}
                      >
                        Date
                      </th>
                      <th
                        style={{
                          padding: "3px 4px",
                          textAlign: "left",
                          fontWeight: "bold",
                          fontSize: "10px",
                        }}
                      >
                        Note
                      </th>
                      <th
                        style={{
                          padding: "3px 4px",
                          textAlign: "center",
                          fontWeight: "bold",
                          fontSize: "10px",
                        }}
                      >
                        Fait
                      </th>
                      <th
                        style={{
                          padding: "3px 4px",
                          textAlign: "right",
                          fontWeight: "bold",
                          fontSize: "10px",
                        }}
                      >
                        Crédit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Ligne de total en haut, juste sous les en-têtes */}
                    <tr style={{ background: "#d8eaff", fontWeight: "bold" }}>
                      <td style={{ padding: "2px 4px", fontSize: "9px" }}>
                        Total
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "right",
                          fontSize: "9px",
                        }}
                      >
                        {ficheStats.totalDu.toLocaleString("fr-FR")}
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "right",
                          fontSize: "9px",
                        }}
                      >
                        {ficheStats.totalPaye.toLocaleString("fr-FR")}
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          fontSize: "9px",
                        }}
                      >
                        —
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "left",
                          fontSize: "9px",
                        }}
                      >
                        —
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "center",
                          fontSize: "9px",
                        }}
                      >
                        —
                      </td>
                      <td
                        style={{
                          padding: "2px 4px",
                          textAlign: "right",
                          fontSize: "9px",
                          color:
                            ficheStats.totalCredit >= 0 ? "#27ae60" : "#c0392b",
                        }}
                      >
                        {ficheStats.totalCredit.toLocaleString("fr-FR")}
                      </td>
                    </tr>
                    {ficheStats.rdvList.map((apt, idx) => {
                      const d = new Date(Number(apt.dateHeure) / 1_000_000);
                      const dateStr = d.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                      });
                      const bg = idx % 2 === 0 ? "#ffffff" : "#f2f2f2";
                      // Crédit de la ligne = Payé - Dû si fait, sinon Payé (avance)
                      const ligneCredit = apt.fait
                        ? Number(apt.montantPaye) - Number(apt.montantDu)
                        : Number(apt.montantPaye);
                      // Colonne Fait : "Annulé" si annulé, "✓" si fait, "-" sinon
                      const faitLabel = apt.annule
                        ? "Annulé"
                        : apt.fait
                          ? "✓"
                          : "-";
                      return (
                        <tr key={apt.id.toString()} style={{ background: bg }}>
                          <td style={{ padding: "2px 4px" }}>{dateStr}</td>
                          <td
                            style={{ padding: "2px 4px", textAlign: "right" }}
                          >
                            {Number(apt.montantDu).toLocaleString("fr-FR")}
                          </td>
                          <td
                            style={{ padding: "2px 4px", textAlign: "right" }}
                          >
                            {Number(apt.montantPaye).toLocaleString("fr-FR")}
                          </td>
                          <td style={{ padding: "2px 4px" }}>
                            {paymentDatesMap.get(apt.id.toString()) ?? ""}
                          </td>
                          <td
                            style={{
                              padding: "2px 4px",
                              textAlign: "left",
                              maxWidth: "80px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={apt.commentaireManuel ?? ""}
                          >
                            {apt.commentaireManuel || ""}
                          </td>
                          <td
                            style={{
                              padding: "2px 4px",
                              textAlign: "center",
                              color: apt.annule ? "#c0392b" : "inherit",
                              fontStyle: apt.annule ? "italic" : "normal",
                            }}
                          >
                            {faitLabel}
                          </td>
                          <td
                            style={{
                              padding: "2px 4px",
                              textAlign: "right",
                              color: ligneCredit >= 0 ? "#27ae60" : "#c0392b",
                            }}
                          >
                            {ligneCredit.toLocaleString("fr-FR")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Panneau gauche : RECHERCHE ──
  const renderSearchPanel = () => (
    <Card className="lg:col-span-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="frame-title">Rechercher un client</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPanelMode("form");
              handleResetSearch();
            }}
            className="table-data"
            data-ocid="client.search.close_button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="table-data">
          Renseignez un ou plusieurs critères
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="table-header">Nom</Label>
          <Input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Rechercher par nom..."
            className="table-data"
            data-ocid="client.search_name.input"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <div>
          <Label className="table-header">Prénom</Label>
          <Input
            value={searchPrenom}
            onChange={(e) => setSearchPrenom(e.target.value)}
            placeholder="Rechercher par prénom..."
            className="table-data"
            data-ocid="client.search_prenom.input"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <div>
          <Label className="table-header">Référence</Label>
          <Input
            value={searchRef}
            onChange={(e) => setSearchRef(e.target.value)}
            placeholder="Référence client..."
            className="table-data"
            data-ocid="client.search_ref.input"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <div>
          <Label className="table-header">Téléphone</Label>
          <Input
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            placeholder="Numéro de téléphone..."
            className="table-data"
            data-ocid="client.search_phone.input"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <div>
          <Label className="table-header">Service</Label>
          <Input
            value={searchService}
            onChange={(e) => setSearchService(e.target.value)}
            placeholder="Service..."
            className="table-data"
            data-ocid="client.search_service.input"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSearch}
            className="flex-1 table-data"
            data-ocid="client.search.button"
          >
            <Search className="h-4 w-4 mr-2" />
            Rechercher
          </Button>
          {searchResults !== null && (
            <Button
              variant="outline"
              onClick={handleResetSearch}
              className="table-data"
              data-ocid="client.search_reset.button"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Résultats de recherche */}
        {searchResults !== null && (
          <div className="mt-2">
            <p className="table-header font-bold mb-2">
              {searchResults.length === 0
                ? "Aucun résultat"
                : `${searchResults.length} client(s) trouvé(s)`}
            </p>
            <div className="space-y-1">
              {searchResults.map((c) => (
                <button
                  key={c.id.toString()}
                  type="button"
                  className="flex items-center justify-between w-full rounded border px-2 py-1 cursor-pointer hover:bg-muted/50 text-left"
                  style={{ fontSize: "9px", fontFamily: "Verdana, sans-serif" }}
                  onClick={() => handleViewFiche(c)}
                  data-ocid="client.search_result.item"
                >
                  <div>
                    <span className="font-bold" style={{ fontSize: "10px" }}>
                      {c.clientName}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      {c.referenceClient}
                    </span>
                  </div>
                  <Search className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ── Panneau gauche : FORMULAIRE ──
  const renderFormPanel = () => (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="frame-title">
          {editingClientId ? "Modifier le client" : "Ajouter un client"}
        </CardTitle>
        <CardDescription className="table-data">
          {editingClientId
            ? "Modifiez les informations du client sélectionné"
            : "Remplissez le formulaire pour ajouter un nouveau client"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="clientName" className="table-header">
              Nom du client (optionnel)
            </Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) =>
                setFormData({ ...formData, clientName: e.target.value })
              }
              className="table-data"
              data-ocid="client.form_name.input"
            />
          </div>

          <div>
            <Label
              htmlFor="addPrenom"
              style={{ fontFamily: "Verdana, sans-serif", fontSize: 12 }}
            >
              Prénom (optionnel)
            </Label>
            <Input
              id="addPrenom"
              value={extraFields.prenom}
              onChange={(e) =>
                setExtraFields({ ...extraFields, prenom: e.target.value })
              }
              placeholder="Prénom du client"
              style={{ fontFamily: "Verdana, sans-serif", fontSize: 12 }}
              data-ocid="client.form_prenom.input"
            />
          </div>

          <div>
            <Label htmlFor="referenceClient" className="table-header">
              Référence client *
            </Label>
            <div className="relative">
              <Input
                id="referenceClient"
                value={formData.referenceClient}
                onChange={(e) =>
                  !editingClientId &&
                  setFormData({
                    ...formData,
                    referenceClient: e.target.value,
                  })
                }
                required
                readOnly={!!editingClientId}
                className={`table-data ${editingClientId ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}`}
                data-ocid="client.form_ref.input"
              />
            </div>
            {editingClientId && (
              <p
                className="table-data text-muted-foreground mt-1"
                style={{ fontSize: 9 }}
              >
                🔒 La référence ne peut pas être modifiée après la création
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="phoneNumber" className="table-header">
              Téléphone
            </Label>
            <Input
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(e) =>
                setFormData({ ...formData, phoneNumber: e.target.value })
              }
              className="table-data"
              data-ocid="client.form_phone.input"
            />
          </div>

          <div>
            <Label htmlFor="address" className="table-header">
              Adresse
            </Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="table-data"
              data-ocid="client.form_address.input"
            />
          </div>

          <div>
            <Label htmlFor="service" className="table-header">
              Service
            </Label>
            <Input
              id="service"
              value={formData.service}
              onChange={(e) =>
                setFormData({ ...formData, service: e.target.value })
              }
              className="table-data"
              data-ocid="client.form_service.input"
            />
          </div>

          <div>
            <Label htmlFor="notes" className="table-header">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="table-data"
              data-ocid="client.form_notes.textarea"
            />
          </div>

          <div>
            <Label htmlFor="courriel1" className="table-header">
              Courriel 1
            </Label>
            <Input
              id="courriel1"
              value={extraFields.courriel1}
              onChange={(e) =>
                setExtraFields({ ...extraFields, courriel1: e.target.value })
              }
              className="table-data"
              data-ocid="client.form_courriel1.input"
            />
          </div>

          <div>
            <Label htmlFor="courriel2" className="table-header">
              Courriel 2
            </Label>
            <Input
              id="courriel2"
              value={extraFields.courriel2}
              onChange={(e) =>
                setExtraFields({ ...extraFields, courriel2: e.target.value })
              }
              className="table-data"
              data-ocid="client.form_courriel2.input"
            />
          </div>

          <div>
            <Label htmlFor="dateNaissance" className="table-header">
              Date de naissance
            </Label>
            <Input
              id="dateNaissance"
              value={extraFields.dateNaissance}
              onChange={(e) =>
                setExtraFields({
                  ...extraFields,
                  dateNaissance: e.target.value,
                })
              }
              className="table-data"
              placeholder="JJ/MM/AAAA"
              data-ocid="client.form_datenaissance.input"
            />
          </div>

          <div>
            <Label htmlFor="nomSecondContact" className="table-header">
              Nom Second contact
            </Label>
            <Input
              id="nomSecondContact"
              value={extraFields.nomSecondContact}
              onChange={(e) =>
                setExtraFields({
                  ...extraFields,
                  nomSecondContact: e.target.value,
                })
              }
              className="table-data"
              data-ocid="client.form_nom_second_contact.input"
            />
          </div>

          <div>
            <Label htmlFor="telephoneSecondContact" className="table-header">
              Téléphone second contact
            </Label>
            <Input
              id="telephoneSecondContact"
              value={extraFields.telephoneSecondContact}
              onChange={(e) =>
                setExtraFields({
                  ...extraFields,
                  telephoneSecondContact: e.target.value,
                })
              }
              className="table-data"
              data-ocid="client.form_tel_second_contact.input"
            />
          </div>

          <ClientPhotoField
            value={formData.photo}
            onChange={(photo) => setFormData({ ...formData, photo })}
          />

          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1 table-data"
              data-ocid="client.form.submit_button"
            >
              <Save className="h-4 w-4 mr-2" />
              {editingClientId ? "Mettre à jour" : "Ajouter"}
            </Button>
            {editingClientId && (
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="table-data"
                data-ocid="client.form.cancel_button"
              >
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <h1 className="frame-title text-3xl mb-8">Base de données clients</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── PANNEAU GAUCHE ── */}
          {panelMode === "fiche"
            ? renderFichePanel()
            : panelMode === "search"
              ? renderSearchPanel()
              : renderFormPanel()}

          {/* ── LISTE DES CLIENTS ── */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="frame-title">Liste des clients</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPanelMode("form");
                    }}
                    className="table-data bg-blue-50 border-blue-300"
                    data-ocid="client.add_client.button"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Ajouter Un Client
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPanelMode(panelMode === "search" ? "form" : "search")
                    }
                    className="table-data"
                    data-ocid="client.search_toggle.button"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Rechercher
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortAlphabetically(!sortAlphabetically)}
                    className="table-data"
                    data-ocid="client.sort.toggle"
                  >
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    {sortAlphabetically ? "Ordre original" : "Tri A-Z"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    disabled={sortedClients.length === 0}
                    className="table-data"
                    data-ocid="client.export_csv.button"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportHtml}
                    disabled={sortedClients.length === 0}
                    className="table-data"
                    data-ocid="client.export_html.button"
                  >
                    <FileCode className="h-4 w-4 mr-2" />
                    Exporter en HTML
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table
                  data-ocid="client.table"
                  style={{ width: "100%", tableLayout: "auto" }}
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="table-header"
                        style={{ whiteSpace: "nowrap", padding: "4px 6px" }}
                      >
                        Actions
                      </TableHead>
                      <TableHead
                        className="table-header"
                        style={{ whiteSpace: "nowrap", padding: "4px 6px" }}
                      >
                        Photo
                      </TableHead>
                      <TableHead
                        className="table-header"
                        style={{ whiteSpace: "nowrap", padding: "4px 6px" }}
                      >
                        Nom
                      </TableHead>
                      <TableHead
                        className="table-header"
                        style={{ whiteSpace: "nowrap", padding: "4px 6px" }}
                      >
                        Référence
                      </TableHead>
                      <TableHead
                        className="table-header"
                        style={{ whiteSpace: "nowrap", padding: "4px 6px" }}
                      >
                        Téléphone
                      </TableHead>
                      <TableHead
                        className="table-header"
                        style={{ whiteSpace: "nowrap", padding: "4px 6px" }}
                      >
                        Adresse
                      </TableHead>
                      <TableHead
                        className="table-header"
                        style={{ whiteSpace: "nowrap", padding: "4px 6px" }}
                      >
                        Service
                      </TableHead>
                      <TableHead
                        className="table-header"
                        style={{ whiteSpace: "nowrap", padding: "4px 6px" }}
                      >
                        Notes
                      </TableHead>
                      <TableHead
                        className="text-right table-header"
                        style={{ whiteSpace: "nowrap", padding: "4px 6px" }}
                      >
                        Payé en 2026
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedClients.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center table-data text-muted-foreground"
                          data-ocid="client.table.empty_state"
                        >
                          Aucun client enregistré
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedClients.map((client, idx) => (
                        <TableRow
                          key={client.id.toString()}
                          className={
                            editingClientId === client.id ||
                            ficheClient?.id === client.id
                              ? "bg-muted/50"
                              : ""
                          }
                          data-ocid={`client.table.row.${idx + 1}`}
                        >
                          <TableCell className="table-data">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPanelMode("form");
                                }}
                                className="table-data bg-blue-50 border-blue-300"
                                data-ocid="client.add_client.button"
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Ajouter Un Client
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewFiche(client)}
                                className="table-data"
                                data-ocid={`client.view_fiche.button.${idx + 1}`}
                              >
                                Fiche
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClientSelect(client)}
                                className="table-data"
                                data-ocid={`client.edit.button.${idx + 1}`}
                              >
                                Modifier
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteClick(client.id)}
                                className="table-data"
                                data-ocid={`client.delete.button.${idx + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
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
                          <TableCell className="table-data">
                            {(() => {
                              const ext =
                                allExtraFields[client.referenceClient];
                              const prenom = ext?.prenom?.trim();
                              return prenom
                                ? `${prenom}, ${client.clientName}`
                                : client.clientName;
                            })()}
                          </TableCell>
                          <TableCell className="table-data">
                            {client.referenceClient}
                          </TableCell>
                          <TableCell className="table-data">
                            {client.phoneNumber || "-"}
                          </TableCell>
                          <TableCell className="table-data">
                            {client.address || "-"}
                          </TableCell>
                          <TableCell className="table-data">
                            {client.service || "-"}
                          </TableCell>
                          <TableCell
                            className="table-data max-w-xs truncate"
                            title={client.notes}
                          >
                            {client.notes || "-"}
                          </TableCell>
                          <TableCell className="text-right table-data">
                            {calculatePaidThisYear(
                              client.referenceClient,
                            ).toLocaleString("fr-FR")}
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
        <AlertDialogContent data-ocid="client.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="frame-title">
              Confirmer la suppression
            </AlertDialogTitle>
            <AlertDialogDescription className="table-data">
              Êtes-vous sûr de vouloir supprimer ce client ? Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="table-data"
              data-ocid="client.delete.cancel_button"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="table-data"
              data-ocid="client.delete.confirm_button"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
