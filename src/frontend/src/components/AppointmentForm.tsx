import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { useStore } from "../store/useStore";
import type { Appointment } from "../types";

interface AppointmentFormProps {
  onClose: () => void;
  editAppointment?: Appointment | null;
  defaultDate?: string;
}

function generateId() {
  return `appt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Simple mini datepicker
function MiniDatePicker({
  value,
  onChange,
}: { value: string; onChange: (val: string) => void }) {
  const { t, tArr } = useTranslation();
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  const months = tArr("calendar.months");
  const daysAbrev = tArr("calendar.jours_abrev");
  const displayValue = value ? value.split("-").reverse().join("/") : "";

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function daysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate();
  }
  function firstDay(y: number, m: number) {
    const d = new Date(y, m, 1).getDay();
    return d === 0 ? 6 : d - 1;
  }

  return (
    <div className="relative">
      <input
        id="rdv-date-input"
        readOnly
        value={displayValue}
        placeholder={t("appointment_form.jj_mm_aaaa")}
        onClick={() => setOpen((o) => !o)}
        className="w-full border border-input rounded px-2 py-1 text-xs bg-background text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
        style={{ fontFamily: "Verdana" }}
      />
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded shadow-lg p-2"
          style={{ minWidth: 220 }}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else setViewMonth((m) => m - 1);
              }}
              className="px-2 py-0.5 text-xs hover:bg-muted rounded"
            >
              ‹
            </button>
            <span className="text-xs font-semibold">
              {months[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else setViewMonth((m) => m + 1);
              }}
              className="px-2 py-0.5 text-xs hover:bg-muted rounded"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {daysAbrev.map((d) => (
              <div
                key={d}
                className="text-center text-xs text-muted-foreground py-0.5"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from(
              { length: firstDay(viewYear, viewMonth) },
              (_, idx) => `blank-${viewYear}-${viewMonth}-${idx}`,
            ).map((k) => (
              <div key={k} />
            ))}
            {Array.from({ length: daysInMonth(viewYear, viewMonth) }).map(
              (_, i) => {
                const day = i + 1;
                const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    className={`text-xs py-0.5 rounded text-center hover:bg-primary/20 ${iso === value ? "bg-primary text-primary-foreground" : iso === todayStr ? "bg-yellow-200 dark:bg-yellow-800" : ""}`}
                  >
                    {day}
                  </button>
                );
              },
            )}
          </div>
          <div className="flex justify-between mt-2 pt-1 border-t border-border">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("appointment_form.btn_effacer")}
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todayStr);
                setOpen(false);
              }}
              className="text-xs text-primary"
            >
              {t("appointment_form.btn_aujourd_hui")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppointmentForm({
  onClose,
  editAppointment,
  defaultDate,
}: AppointmentFormProps) {
  const { t, tArr } = useTranslation();
  const { clients, appointments, addAppointment, updateAppointment } =
    useStore();

  const [clientRef, setClientRef] = useState(editAppointment?.clientRef ?? "");
  const [date, setDate] = useState(editAppointment?.date ?? defaultDate ?? "");
  const [heureDebut, setHeureDebut] = useState(
    editAppointment?.heureDebut ?? "09:00",
  );
  const [heureFin, setHeureFin] = useState(
    editAppointment?.heureFin ?? "10:00",
  );
  const [tarif, setTarif] = useState(String(editAppointment?.tarif ?? 0));
  const [note, setNote] = useState(editAppointment?.note ?? "");
  const [fait, setFait] = useState(editAppointment?.fait ?? false);
  const [annule, setAnnule] = useState(editAppointment?.annule ?? false);
  const [montantPaye, setMontantPaye] = useState(
    String(editAppointment?.montantPaye ?? 0),
  );
  const [montantDu, setMontantDu] = useState(
    String(editAppointment?.montantDu ?? 0),
  );
  const [recType, setRecType] = useState<"" | "hebdomadaire">("");
  const [recJours, setRecJours] = useState<number[]>([]);

  const selectedClient = clients.find((c) => c.reference === clientRef);
  const sortedClients = [...clients].sort((a, b) => {
    const na = [a.prenom, a.nom].filter(Boolean).join(" ");
    const nb = [b.prenom, b.nom].filter(Boolean).join(" ");
    return na.localeCompare(nb);
  });

  useEffect(() => {
    if (selectedClient) {
      setTarif(String(selectedClient.tarifHoraire || 0));
      setMontantDu(String(selectedClient.tarifHoraire || 0));
    }
  }, [selectedClient]);

  const days = tArr("calendar.jours");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientRef || !date) return;
    const client = clients.find((c) => c.reference === clientRef);
    const du = annule ? 0 : Number(montantDu);

    if (editAppointment) {
      updateAppointment(editAppointment.id, {
        clientRef,
        clientNom: client?.nom ?? "",
        clientPrenom: client?.prenom ?? "",
        date,
        heureDebut,
        heureFin,
        tarif: Number(tarif),
        note,
        fait,
        annule,
        statut: annule ? "annule" : fait ? "fait" : "non-traite",
        montantPaye: Number(montantPaye),
        montantDu: du,
      });
      onClose();
      return;
    }

    const datesToCreate: string[] = [date];
    if (recType === "hebdomadaire" && recJours.length > 0) {
      const baseDate = new Date(date);
      for (let w = 1; w <= 52; w++) {
        for (const jourIdx of recJours) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + w * 7);
          const jsDay = d.getDay();
          const ourDay = jsDay === 0 ? 6 : jsDay - 1;
          if (ourDay === jourIdx) {
            const iso = d.toISOString().split("T")[0];
            if (!datesToCreate.includes(iso)) datesToCreate.push(iso);
          }
        }
      }
    }

    for (const d of datesToCreate) {
      const alreadyExists = appointments.some(
        (a) =>
          a.clientRef === clientRef &&
          a.date === d &&
          a.heureDebut === heureDebut,
      );
      if (alreadyExists && d !== date) continue;
      addAppointment({
        id: generateId(),
        clientRef,
        clientNom: client?.nom ?? "",
        clientPrenom: client?.prenom ?? "",
        date: d,
        heureDebut,
        heureFin,
        duree: 60,
        tarif: Number(tarif),
        statut: annule ? "annule" : fait ? "fait" : "non-traite",
        fait,
        annule,
        paymentDate: "",
        montantPaye: Number(montantPaye),
        montantDu: du,
        note,
        recurrence: recType
          ? { type: recType, jourSemaine: recJours[0] ?? 0 }
          : undefined,
      });
    }
    onClose();
  }

  const labelCls = "block text-xs text-muted-foreground mb-1";
  const inputCls =
    "w-full border border-input rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex items-center justify-center m-0 p-0 max-w-none max-h-none w-full h-full border-none"
      style={{
        background: "rgba(0,0,0,0.5)",
        fontFamily: "Verdana, Geneva, sans-serif",
      }}
    >
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <h2 className="font-bold text-sm text-foreground">
            {editAppointment
              ? t("appointment_form.titre_modifier")
              : t("appointment_form.titre_nouveau")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
          <div>
            <label htmlFor="rdv-client" className={labelCls}>
              {t("appointment_form.info_client")}
            </label>
            <select
              id="rdv-client"
              data-ocid="rdv-client-select"
              value={clientRef}
              onChange={(e) => setClientRef(e.target.value)}
              required
              className={inputCls}
              style={{ fontFamily: "Verdana" }}
            >
              <option value="">{t("appointment_form.select_client")}</option>
              {sortedClients.map((c) => {
                const name =
                  [c.prenom, c.nom].filter(Boolean).join(", ") || c.reference;
                return (
                  <option key={c.id} value={c.reference}>
                    {c.reference} — {name}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedClient && (
            <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
              {selectedClient.telephone && (
                <span>
                  {t("appointment_form.telephone")}: {selectedClient.telephone}{" "}
                  ·{" "}
                </span>
              )}
              {selectedClient.adresse && (
                <span>
                  {t("appointment_form.adresse")}: {selectedClient.adresse}
                </span>
              )}
            </div>
          )}

          <div>
            <label htmlFor="rdv-date-input" className={labelCls}>
              {t("appointment_form.date")}
            </label>
            <MiniDatePicker value={date} onChange={setDate} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="rdv-debut" className={labelCls}>
                {t("appointment_form.heure_debut")}
              </label>
              <input
                id="rdv-debut"
                type="time"
                value={heureDebut}
                onChange={(e) => setHeureDebut(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="rdv-fin" className={labelCls}>
                {t("appointment_form.heure_fin")}
              </label>
              <input
                id="rdv-fin"
                type="time"
                value={heureFin}
                onChange={(e) => setHeureFin(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label htmlFor="rdv-tarif" className={labelCls}>
              {t("appointment_form.tarif")}
            </label>
            <input
              id="rdv-tarif"
              type="number"
              value={tarif}
              onChange={(e) => setTarif(e.target.value)}
              className={`${inputCls} input-no-spinner`}
              min={0}
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                id="rdv-fait"
                checked={fait}
                onChange={(e) => setFait(e.target.checked)}
              />
              <span>{t("appointment_form.fait")}</span>
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                id="rdv-annule"
                checked={annule}
                onChange={(e) => setAnnule(e.target.checked)}
              />
              <span>{t("appointment_form.annule")}</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="rdv-du" className={labelCls}>
                {t("appointment_form.montant_du")}
              </label>
              <input
                id="rdv-du"
                type="number"
                value={annule ? "0" : montantDu}
                onChange={(e) => setMontantDu(e.target.value)}
                disabled={annule}
                className={`${inputCls} input-no-spinner disabled:opacity-50`}
                min={0}
              />
            </div>
            <div>
              <label htmlFor="rdv-paye" className={labelCls}>
                {t("appointment_form.montant_paye")}
              </label>
              <input
                id="rdv-paye"
                type="number"
                value={montantPaye}
                onChange={(e) => setMontantPaye(e.target.value)}
                className={`${inputCls} input-no-spinner`}
                min={0}
              />
            </div>
          </div>

          <div>
            <label htmlFor="rdv-note" className={labelCls}>
              {t("appointment_form.note")}
            </label>
            <input
              id="rdv-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputCls}
            />
          </div>

          {!editAppointment && (
            <div>
              <label htmlFor="rdv-rec" className={labelCls}>
                {t("appointment_form.recurrence")}
              </label>
              <select
                id="rdv-rec"
                value={recType}
                onChange={(e) =>
                  setRecType(e.target.value as "" | "hebdomadaire")
                }
                className={inputCls}
              >
                <option value="">—</option>
                <option value="hebdomadaire">
                  {t("appointment_form.hebdomadaire")}
                </option>
              </select>
              {recType === "hebdomadaire" && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("appointment_form.jours_semaine")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {days.map((d, i) => (
                      <label
                        key={d}
                        className="flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={recJours.includes(i)}
                          onChange={(e) =>
                            setRecJours((prev) =>
                              e.target.checked
                                ? [...prev, i]
                                : prev.filter((j) => j !== i),
                            )
                          }
                        />
                        <span>{d}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs border border-border rounded text-foreground hover:bg-muted transition-smooth"
            >
              {t("appointment_form.btn_annuler")}
            </button>
            <button
              type="submit"
              data-ocid="rdv-form-submit"
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-smooth"
            >
              {editAppointment
                ? t("appointment_form.btn_modifier")
                : t("appointment_form.btn_creer")}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
