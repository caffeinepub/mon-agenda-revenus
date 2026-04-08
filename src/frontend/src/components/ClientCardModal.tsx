import { useTranslation } from "../hooks/useTranslation";
import { useStore } from "../store/useStore";
import type { Appointment, Client } from "../types";

interface ClientCardModalProps {
  client: Client;
  onClose: () => void;
}

function calcClientCredit(appointments: Appointment[], client: Client) {
  const clientAppts = appointments
    .filter((a) => a.clientRef === client.reference)
    .sort((a, b) => a.date.localeCompare(b.date));

  let credit = 0;
  return clientAppts.map((appt) => {
    const du = appt.annule ? 0 : appt.montantDu;
    credit = credit + appt.montantPaye - du;
    return { appt, credit };
  });
}

export function ClientCardModal({ client, onClose }: ClientCardModalProps) {
  const { t } = useTranslation();
  const { appointments } = useStore();

  const rows = calcClientCredit(appointments, client).reverse();
  const totalCredit = rows.length > 0 ? rows[0].credit : 0;

  const displayName =
    [client.prenom, client.nom].filter(Boolean).join(", ") || client.reference;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 m-0 p-0 max-w-none max-h-none w-full h-full border-none"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40 rounded-t-lg">
          <h2 className="font-bold text-sm text-foreground">
            {t("calendar.fiche_client_titre")} — {displayName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
            aria-label={t("common.fermer")}
          >
            ✕
          </button>
        </div>

        {/* Client info */}
        <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground grid grid-cols-2 gap-x-4">
          <span>
            {t("clients.reference")}:{" "}
            <strong className="text-foreground">{client.reference}</strong>
          </span>
          {client.telephone && (
            <span>
              {t("clients.telephone")}: {client.telephone}
            </span>
          )}
          {client.service && (
            <span>
              {t("clients.service")}: {client.service}
            </span>
          )}
          {client.email1 && (
            <span>
              {t("clients.email1")}: {client.email1}
            </span>
          )}
        </div>

        {/* Appointments table */}
        <div className="flex-1 overflow-auto px-4 py-2">
          <p className="text-xs font-semibold text-foreground mb-1">
            {t("calendar.fiche_rdv_titre")}
          </p>
          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse text-xs"
              style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
            >
              <thead>
                <tr className="bg-primary/10">
                  <th className="border border-border px-2 py-1 text-left">
                    {t("dashboard.col_date")}
                  </th>
                  <th className="border border-border px-2 py-1 text-center">
                    {t("calendar.col_fait")}
                  </th>
                  <th className="border border-border px-2 py-1 text-center">
                    {t("calendar.col_annule")}
                  </th>
                  <th className="border border-border px-2 py-1 text-right">
                    {t("calendar.col_du")}
                  </th>
                  <th className="border border-border px-2 py-1 text-right">
                    {t("calendar.col_paye")}
                  </th>
                  <th className="border border-border px-2 py-1 text-right">
                    {t("calendar.col_date_pmt")}
                  </th>
                  <th className="border border-border px-2 py-1 text-right font-bold">
                    {t("calendar.col_credit")}
                  </th>
                </tr>
                {/* Total credit row */}
                <tr className="bg-muted/40">
                  <td className="border border-border px-2 py-1" colSpan={6} />
                  <td
                    className={`border border-border px-2 py-1 text-right font-bold ${totalCredit < 0 ? "text-destructive" : "text-foreground"}`}
                  >
                    {totalCredit.toFixed(2)}
                  </td>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ appt, credit }, i) => {
                  const du = appt.annule ? 0 : appt.montantDu;
                  return (
                    <tr
                      key={appt.id}
                      className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <td className="border border-border px-2 py-1">
                        {appt.date}
                      </td>
                      <td className="border border-border px-2 py-1 text-center">
                        {appt.fait ? "✓" : ""}
                      </td>
                      <td className="border border-border px-2 py-1 text-center">
                        {appt.annule ? "✓" : ""}
                      </td>
                      <td className="border border-border px-2 py-1 text-right">
                        {du.toFixed(2)}
                      </td>
                      <td className="border border-border px-2 py-1 text-right">
                        {appt.montantPaye.toFixed(2)}
                      </td>
                      <td className="border border-border px-2 py-1 text-right">
                        {appt.paymentDate ?? ""}
                      </td>
                      <td
                        className={`border border-border px-2 py-1 text-right font-semibold ${credit < 0 ? "text-destructive" : ""}`}
                      >
                        {credit.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-smooth"
          >
            {t("common.fermer")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
