import { Search, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "../hooks/useTranslation";
import { useStore } from "../store/useStore";
import type { Appointment, Client } from "../types";

function generateId() {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const emptyClient = (): Omit<Client, "id" | "reference" | "createdAt"> => ({
  nom: "",
  prenom: "",
  email1: "",
  email2: "",
  dateNaissance: "",
  nom2Contact: "",
  tel2Contact: "",
  telephone: "",
  adresse: "",
  service: "",
  note: "",
  photo: "",
  tarifHoraire: 0,
});

function calcClientCredit(appointments: Appointment[], client: Client) {
  const rows = appointments
    .filter((a) => a.clientRef === client.reference)
    .sort((a, b) => a.date.localeCompare(b.date));
  let credit = 0;
  return rows
    .map((appt) => {
      const du = appt.annule ? 0 : appt.montantDu;
      credit = credit + appt.montantPaye - du;
      return { appt, credit };
    })
    .reverse();
}

export function BaseClient() {
  const { t } = useTranslation();
  const {
    clients,
    appointments,
    addClient,
    updateClient,
    deleteClient,
    nextClientRef,
  } = useStore();

  const [panelMode, setPanelMode] = useState<
    "hidden" | "add" | "edit" | "card"
  >("hidden");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [refLocked, setRefLocked] = useState(false);

  // Form state
  const [formRef, setFormRef] = useState("");
  const [formData, setFormData] = useState(emptyClient());

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q)
      return [...clients].sort((a, b) =>
        [a.prenom, a.nom]
          .filter(Boolean)
          .join(" ")
          .localeCompare([b.prenom, b.nom].filter(Boolean).join(" ")),
      );
    return clients
      .filter((c) =>
        [c.nom, c.prenom, c.reference, c.telephone, c.service].some((v) =>
          v?.toLowerCase().includes(q),
        ),
      )
      .sort((a, b) =>
        [a.prenom, a.nom]
          .filter(Boolean)
          .join(" ")
          .localeCompare([b.prenom, b.nom].filter(Boolean).join(" ")),
      );
  }, [clients, searchQuery]);

  function openAdd() {
    const ref = nextClientRef();
    setFormRef(ref);
    setFormData(emptyClient());
    setRefLocked(false);
    setPanelMode("add");
    setSelectedId(null);
  }

  function openEdit(client: Client) {
    setSelectedId(client.id);
    setFormRef(client.reference);
    // Guard against undefined values from old localStorage data (migration safety)
    setFormData({
      nom: client.nom ?? "",
      prenom: client.prenom ?? "",
      email1: client.email1 ?? "",
      email2: client.email2 ?? "",
      dateNaissance: client.dateNaissance ?? "",
      nom2Contact: client.nom2Contact ?? "",
      tel2Contact: client.tel2Contact ?? "",
      telephone: client.telephone ?? "",
      adresse: client.adresse ?? "",
      service: client.service ?? "",
      note: client.note ?? "",
      photo: client.photo ?? "",
      tarifHoraire:
        typeof client.tarifHoraire === "number" ? client.tarifHoraire : 0,
    });
    setRefLocked(true);
    setPanelMode("edit");
  }

  function openCard(client: Client) {
    setSelectedId(client.id);
    setPanelMode("card");
  }

  function handleSave() {
    if (panelMode === "add") {
      addClient({
        id: generateId(),
        reference: formRef,
        createdAt: new Date().toISOString(),
        ...formData,
      });
      toast.success(t("clients.msg_ajoute"));
    } else if (panelMode === "edit" && selectedId) {
      updateClient(selectedId, { ...formData });
      toast.success(t("clients.msg_modifie"));
    }
    setPanelMode("hidden");
    setSelectedId(null);
  }

  function handleDelete(client: Client) {
    if (!window.confirm(t("clients.supprimer_confirmation"))) return;
    deleteClient(client.id);
    toast.success(t("clients.msg_supprime"));
    if (selectedId === client.id) {
      setPanelMode("hidden");
      setSelectedId(null);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setFormData((d) => ({ ...d, photo: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function exportCSV() {
    const header = [
      t("clients.col_reference"),
      t("clients.col_nom"),
      t("clients.telephone"),
      t("clients.service"),
    ].join(";");
    const rows = filteredClients.map((c) =>
      [
        c.reference,
        [c.prenom, c.nom].filter(Boolean).join(", "),
        c.telephone,
        c.service,
      ].join(";"),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputCls =
    "w-full border border-input rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring dark:bg-card dark:text-foreground dark:border-border";
  const labelCls = "block text-xs text-muted-foreground mb-0.5";
  // Dark mode: replace bg-primary/10 (stays light) with dark:bg-muted dark:text-foreground
  const thCls =
    "border border-border px-2 py-1 text-xs font-semibold text-left bg-primary/10 dark:bg-muted dark:text-foreground";
  const tdCls = "border border-border px-2 py-1 text-xs text-foreground";

  return (
    <div
      className="flex h-full"
      style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
    >
      {/* Left panel */}
      {panelMode !== "hidden" && (
        <div className="w-80 flex-shrink-0 border-r border-border bg-card dark:bg-card overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40 dark:bg-muted/20">
            <h3 className="font-bold text-xs text-foreground">
              {panelMode === "add"
                ? t("clients.titre_ajouter")
                : panelMode === "edit"
                  ? t("clients.titre_modifier")
                  : t("clients.titre_fiche")}
            </h3>
            <button
              type="button"
              onClick={() => setPanelMode("hidden")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>

          {panelMode === "card" && selectedClient ? (
            <div className="p-3 space-y-2">
              {selectedClient.photo &&
                (() => {
                  const cardName =
                    [selectedClient.prenom, selectedClient.nom]
                      .filter(Boolean)
                      .join(", ") || selectedClient.reference;
                  return (
                    <img
                      src={selectedClient.photo}
                      alt={cardName}
                      className="w-20 h-24 object-cover rounded border border-border"
                    />
                  );
                })()}
              <div className="text-xs space-y-1 text-foreground">
                <p>
                  <strong>{t("clients.reference")}:</strong>{" "}
                  {selectedClient.reference}
                </p>
                {(selectedClient.prenom || selectedClient.nom) && (
                  <p>
                    <strong>{t("clients.nom")}:</strong>{" "}
                    {[selectedClient.prenom, selectedClient.nom]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {selectedClient.telephone && (
                  <p>
                    <strong>{t("clients.telephone")}:</strong>{" "}
                    {selectedClient.telephone}
                  </p>
                )}
                {selectedClient.email1 && (
                  <p>
                    <strong>{t("clients.email1")}:</strong>{" "}
                    {selectedClient.email1}
                  </p>
                )}
                {selectedClient.email2 && (
                  <p>
                    <strong>{t("clients.email2")}:</strong>{" "}
                    {selectedClient.email2}
                  </p>
                )}
                {selectedClient.dateNaissance && (
                  <p>
                    <strong>{t("clients.date_naissance")}:</strong>{" "}
                    {selectedClient.dateNaissance}
                  </p>
                )}
                {selectedClient.nom2Contact && (
                  <p>
                    <strong>{t("clients.nom2_contact")}:</strong>{" "}
                    {selectedClient.nom2Contact}
                  </p>
                )}
                {selectedClient.tel2Contact && (
                  <p>
                    <strong>{t("clients.tel2_contact")}:</strong>{" "}
                    {selectedClient.tel2Contact}
                  </p>
                )}
                {selectedClient.adresse && (
                  <p>
                    <strong>{t("clients.adresse")}:</strong>{" "}
                    {selectedClient.adresse}
                  </p>
                )}
                {selectedClient.service && (
                  <p>
                    <strong>{t("clients.service")}:</strong>{" "}
                    {selectedClient.service}
                  </p>
                )}
                {selectedClient.note && (
                  <p>
                    <strong>{t("clients.note")}:</strong> {selectedClient.note}
                  </p>
                )}
              </div>
              {/* Appointments summary */}
              <div className="mt-3">
                <h4 className="font-bold text-xs text-foreground mb-1">
                  {t("clients.rdv_resume")}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-primary/10 dark:bg-muted">
                        <th className="border border-border px-1 py-0.5 text-left text-foreground">
                          {t("dashboard.col_date")}
                        </th>
                        <th className="border border-border px-1 py-0.5 text-center text-foreground">
                          {t("calendar.col_fait")}
                        </th>
                        <th className="border border-border px-1 py-0.5 text-center text-foreground">
                          {t("calendar.col_annule")}
                        </th>
                        <th className="border border-border px-1 py-0.5 text-right text-foreground">
                          {t("calendar.col_du")}
                        </th>
                        <th className="border border-border px-1 py-0.5 text-right text-foreground">
                          {t("calendar.col_paye")}
                        </th>
                        <th className="border border-border px-1 py-0.5 text-right font-bold text-foreground">
                          {t("calendar.col_credit")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcClientCredit(appointments, selectedClient).map(
                        ({ appt, credit }, i) => {
                          const du = appt.annule ? 0 : appt.montantDu;
                          return (
                            <tr
                              key={appt.id}
                              className={
                                i % 2 === 0 ? "bg-background" : "bg-muted/20"
                              }
                            >
                              <td className="border border-border px-1 py-0.5 text-foreground">
                                {appt.date}
                              </td>
                              <td className="border border-border px-1 py-0.5 text-center text-foreground">
                                {appt.fait ? "✓" : ""}
                              </td>
                              <td className="border border-border px-1 py-0.5 text-center text-foreground">
                                {appt.annule ? "✓" : ""}
                              </td>
                              <td className="border border-border px-1 py-0.5 text-right text-foreground">
                                {du.toFixed(2)}
                              </td>
                              <td className="border border-border px-1 py-0.5 text-right text-foreground">
                                {appt.montantPaye.toFixed(2)}
                              </td>
                              <td
                                className={`border border-border px-1 py-0.5 text-right ${credit < 0 ? "text-destructive" : "text-foreground"}`}
                              >
                                {credit.toFixed(2)}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="p-3 space-y-2"
            >
              {/* Reference */}
              <div>
                <label htmlFor="cli-ref" className={labelCls}>
                  {t("clients.reference")}
                </label>
                <input
                  id="cli-ref"
                  type="text"
                  value={formRef}
                  onChange={(e) => !refLocked && setFormRef(e.target.value)}
                  readOnly={refLocked}
                  className={`${inputCls} ${refLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                />
              </div>
              <div>
                <label htmlFor="cli-nom" className={labelCls}>
                  {t("clients.nom")}
                </label>
                <input
                  id="cli-nom"
                  type="text"
                  value={formData.nom}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, nom: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="cli-prenom" className={labelCls}>
                  {t("clients.prenom")}
                </label>
                <input
                  id="cli-prenom"
                  type="text"
                  value={formData.prenom}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, prenom: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="cli-tel" className={labelCls}>
                  {t("clients.telephone")}
                </label>
                <input
                  id="cli-tel"
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, telephone: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="cli-email1" className={labelCls}>
                  {t("clients.email1")}
                </label>
                <input
                  id="cli-email1"
                  type="email"
                  value={formData.email1}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, email1: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="cli-email2" className={labelCls}>
                  {t("clients.email2")}
                </label>
                <input
                  id="cli-email2"
                  type="email"
                  value={formData.email2}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, email2: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="cli-dob" className={labelCls}>
                  {t("clients.date_naissance")}
                </label>
                <input
                  id="cli-dob"
                  type="text"
                  value={formData.dateNaissance}
                  onChange={(e) =>
                    setFormData((d) => ({
                      ...d,
                      dateNaissance: e.target.value,
                    }))
                  }
                  className={inputCls}
                  placeholder={t("clients.jj_mm_aaaa")}
                />
              </div>
              <div>
                <label htmlFor="cli-addr" className={labelCls}>
                  {t("clients.adresse")}
                </label>
                <input
                  id="cli-addr"
                  type="text"
                  value={formData.adresse}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, adresse: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="cli-service" className={labelCls}>
                  {t("clients.service")}
                </label>
                <input
                  id="cli-service"
                  type="text"
                  value={formData.service}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, service: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="cli-tarif" className={labelCls}>
                  {t("clients.tarif_horaire")}
                </label>
                <input
                  id="cli-tarif"
                  type="number"
                  value={formData.tarifHoraire}
                  onChange={(e) =>
                    setFormData((d) => ({
                      ...d,
                      tarifHoraire: Number(e.target.value),
                    }))
                  }
                  className={`${inputCls} input-no-spinner`}
                  min={0}
                />
              </div>
              <div>
                <label htmlFor="cli-nom2" className={labelCls}>
                  {t("clients.nom2_contact")}
                </label>
                <input
                  id="cli-nom2"
                  type="text"
                  value={formData.nom2Contact}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, nom2Contact: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="cli-tel2" className={labelCls}>
                  {t("clients.tel2_contact")}
                </label>
                <input
                  id="cli-tel2"
                  type="tel"
                  value={formData.tel2Contact}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, tel2Contact: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="cli-note" className={labelCls}>
                  {t("clients.note")}
                </label>
                <textarea
                  id="cli-note"
                  value={formData.note}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, note: e.target.value }))
                  }
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
              {/* Photo */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {t("clients.format_photo")}
                </p>
                <label
                  htmlFor="cli-photo"
                  className="flex items-center gap-2 cursor-pointer px-2 py-1 border border-dashed border-border rounded text-xs text-muted-foreground hover:text-foreground dark:hover:text-foreground"
                >
                  <Upload size={12} /> {t("clients.photo")}
                </label>
                <input
                  id="cli-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                {formData.photo && (
                  <img
                    src={formData.photo}
                    alt={formData.nom || formData.prenom || "client"}
                    className="mt-1 w-16 h-20 object-cover rounded"
                  />
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  type="submit"
                  data-ocid="client-save-btn"
                  className="flex-1 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground"
                >
                  {t("clients.btn_enregistrer")}
                </button>
                <button
                  type="button"
                  onClick={() => setPanelMode("hidden")}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-muted dark:hover:bg-muted dark:text-foreground"
                >
                  {t("clients.btn_annuler")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Right: list */}
      <div className="flex-1 overflow-hidden flex flex-col p-3 gap-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-bold text-sm text-foreground">
            {t("clients.titre_liste")}
          </h2>
          <button
            type="button"
            data-ocid="client-add-btn"
            onClick={openAdd}
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
          >
            {t("clients.btn_ajouter")}
          </button>
          <button
            type="button"
            onClick={() => setShowSearch((s) => !s)}
            className="p-1 border border-border rounded hover:bg-muted dark:hover:bg-muted dark:text-foreground"
            aria-label={t("clients.btn_rechercher")}
          >
            <Search size={14} />
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="px-2 py-1 text-xs border border-border rounded hover:bg-muted dark:hover:bg-muted dark:text-foreground"
          >
            {t("clients.btn_exporter_csv")}
          </button>
        </div>

        {/* Search */}
        {showSearch && (
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("clients.recherche_placeholder")}
              data-ocid="client-search-input"
              className="flex-1 border border-input rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring dark:bg-card dark:text-foreground dark:border-border"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table
            className="w-full border-collapse text-xs bg-card"
            style={{ fontFamily: "Verdana" }}
          >
            <thead>
              <tr>
                <th className={thCls}>{t("clients.col_reference")}</th>
                <th className={thCls}>{t("clients.col_nom")}</th>
                <th className={thCls}>{t("clients.telephone")}</th>
                <th className={thCls}>{t("clients.service")}</th>
                <th className={`${thCls} text-center`}>
                  {t("clients.col_actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className={`${tdCls} text-center text-muted-foreground py-4`}
                  >
                    {t("clients.aucun_client")}
                  </td>
                </tr>
              )}
              {filteredClients.map((client, i) => {
                const displayName =
                  [client.prenom, client.nom].filter(Boolean).join(", ") ||
                  client.reference;
                return (
                  <tr
                    key={client.id}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className={tdCls}>{client.reference}</td>
                    <td className={tdCls}>{displayName}</td>
                    <td className={tdCls}>{client.telephone}</td>
                    <td className={tdCls}>{client.service}</td>
                    <td className={`${tdCls} text-center`}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openCard(client)}
                          className="px-2 py-0.5 text-xs border border-border rounded hover:bg-muted dark:text-foreground dark:hover:bg-muted"
                        >
                          {t("clients.btn_fiche")}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(client)}
                          className="px-2 py-0.5 text-xs border border-border rounded hover:bg-muted dark:text-foreground dark:hover:bg-muted"
                        >
                          {t("clients.btn_modifier")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(client)}
                          className="px-2 py-0.5 text-xs border border-destructive/30 text-destructive rounded hover:bg-destructive/10"
                        >
                          {t("clients.btn_supprimer")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
