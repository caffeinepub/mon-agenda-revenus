import { useMemo, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { useStore } from "../store/useStore";
import type { Appointment } from "../types";

type PeriodType = "mensuel" | "annuel" | "personnalise";

function calcRevenusFaitsEtPayes(appts: Appointment[]): number {
  return appts
    .filter((a) => a.fait && !a.annule && a.montantPaye > 0)
    .reduce((s, a) => s + a.montantPaye, 0);
}

export function RapportPDF() {
  const { t, tArr } = useTranslation();
  const { appointments, clients } = useStore();

  const [periodType, setPeriodType] = useState<PeriodType>("mensuel");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [syntheseStartYear, setSyntheseStartYear] = useState(
    new Date().getFullYear() - 5,
  );

  const monthNames = tArr("dashboard.mois");
  const currentYear = new Date().getFullYear();

  const filteredAppts = useMemo(() => {
    if (periodType === "mensuel") {
      return appointments.filter((a) => {
        const d = new Date(a.date);
        return (
          d.getFullYear() === selectedYear && d.getMonth() === selectedMonth
        );
      });
    }
    if (periodType === "annuel") {
      return appointments.filter(
        (a) => new Date(a.date).getFullYear() === selectedYear,
      );
    }
    if (periodType === "personnalise" && dateDebut && dateFin) {
      return appointments.filter(
        (a) => a.date >= dateDebut && a.date <= dateFin,
      );
    }
    return [];
  }, [
    appointments,
    periodType,
    selectedMonth,
    selectedYear,
    dateDebut,
    dateFin,
  ]);

  // Group by client
  const clientReport = useMemo(() => {
    const map = new Map<
      string,
      { ref: string; name: string; appts: Appointment[] }
    >();
    for (const appt of filteredAppts) {
      if (!map.has(appt.clientRef)) {
        const client = clients.find((c) => c.reference === appt.clientRef);
        const name = client
          ? [client.prenom, client.nom].filter(Boolean).join(", ") ||
            client.reference
          : appt.clientRef;
        map.set(appt.clientRef, { ref: appt.clientRef, name, appts: [] });
      }
      map.get(appt.clientRef)!.appts.push(appt);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [filteredAppts, clients]);

  // 10-year synthesis
  const syntheseRows = useMemo(() => {
    const startY = Math.min(syntheseStartYear, currentYear);
    return Array.from({ length: 10 }, (_, i) => {
      const yr = startY + i;
      const yearAppts = appointments.filter(
        (a) => new Date(a.date).getFullYear() === yr,
      );
      const revenus = calcRevenusFaitsEtPayes(yearAppts);
      const rdvFaits = yearAppts.filter((a) => a.fait && !a.annule).length;
      return { yr, revenus, rdvFaits };
    });
  }, [appointments, syntheseStartYear, currentYear]);

  function exportHTML(tableId: string, filename: string) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title><style>body{font-family:Verdana,sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 8px}th{background:#e8eaf6}</style></head><body>${table.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV(tableId: string, filename: string) {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;
    const rows = Array.from(table.querySelectorAll("tr")).map((row) => {
      return Array.from(row.querySelectorAll("th,td"))
        .map((cell) => `"${cell.textContent?.replace(/"/g, '""') ?? ""}"`)
        .join(";");
    });
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const thCls =
    "border border-border px-2 py-1 text-xs font-semibold bg-primary/10 dark:bg-muted text-foreground";
  const tdCls = "border border-border px-2 py-1 text-xs text-foreground";
  const totalRow = "bg-primary/15 dark:bg-muted/60 font-semibold";
  const inputCls =
    "border border-input rounded px-2 py-1 text-xs bg-background text-foreground dark:bg-card dark:text-foreground dark:border-border";

  return (
    <div
      className="p-4 space-y-4"
      style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
    >
      <h1 className="font-bold text-base text-foreground">
        {t("reports.titre")}
      </h1>

      {/* Period selector */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-3">
        <div className="flex gap-4 text-xs flex-wrap">
          {(["mensuel", "annuel", "personnalise"] as PeriodType[]).map((p) => (
            <label
              key={p}
              className="flex items-center gap-1 cursor-pointer text-foreground"
            >
              <input
                type="radio"
                name="period"
                checked={periodType === p}
                onChange={() => setPeriodType(p)}
              />
              <span>{t(`reports.${p}`)}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap items-end text-xs">
          {(periodType === "mensuel" || periodType === "annuel") && (
            <div>
              <label
                htmlFor="report-year"
                className="block text-muted-foreground mb-0.5"
              >
                {t("reports.annee")}
              </label>
              <input
                id="report-year"
                type="number"
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(Math.min(Number(e.target.value), currentYear))
                }
                max={currentYear}
                min={2000}
                className={`${inputCls} w-24 input-no-spinner`}
              />
            </div>
          )}
          {periodType === "mensuel" && (
            <div>
              <label
                htmlFor="report-month"
                className="block text-muted-foreground mb-0.5"
              >
                {t("reports.mois")}
              </label>
              <select
                id="report-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className={inputCls}
              >
                {monthNames.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
          {periodType === "personnalise" && (
            <>
              <div>
                <label
                  htmlFor="report-start"
                  className="block text-muted-foreground mb-0.5"
                >
                  {t("reports.date_debut")}
                </label>
                <input
                  id="report-start"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label
                  htmlFor="report-end"
                  className="block text-muted-foreground mb-0.5"
                >
                  {t("reports.date_fin")}
                </label>
                <input
                  id="report-end"
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className={inputCls}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Report preview */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold text-sm text-foreground">
            {t("reports.apercu")}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportHTML("report-table", "rapport")}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-muted dark:text-foreground dark:hover:bg-muted"
            >
              {t("reports.btn_exporter_html")}
            </button>
            <button
              type="button"
              onClick={() => exportCSV("report-table", "rapport")}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-muted dark:text-foreground dark:hover:bg-muted"
            >
              {t("reports.btn_exporter_csv")}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            id="report-table"
            className="w-full border-collapse text-xs bg-card"
            style={{ fontFamily: "Verdana" }}
          >
            <thead>
              <tr className={totalRow}>
                <th className={thCls}>{t("reports.col_client")}</th>
                <th className={thCls}>{t("reports.col_ref")}</th>
                <th className={`${thCls} text-right`}>
                  {t("reports.col_nb_rdv")}
                </th>
                <th className={`${thCls} text-right`}>
                  {t("reports.col_total_du")}
                </th>
                <th className={`${thCls} text-right`}>
                  {t("reports.col_total_paye")}
                </th>
                <th className={`${thCls} text-right`}>
                  {t("reports.col_credit")}
                </th>
              </tr>
            </thead>
            <tbody>
              {clientReport.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className={`${tdCls} text-center text-muted-foreground py-4`}
                  >
                    {t("reports.aucune_donnee")}
                  </td>
                </tr>
              )}
              {clientReport.map(({ ref, name, appts }, i) => {
                const du = appts.reduce(
                  (s, a) => s + (a.annule ? 0 : a.montantDu),
                  0,
                );
                const paye = appts.reduce((s, a) => s + a.montantPaye, 0);
                const credit = paye - du;
                return (
                  <tr
                    key={ref}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className={tdCls}>{name}</td>
                    <td className={tdCls}>{ref}</td>
                    <td className={`${tdCls} text-right`}>{appts.length}</td>
                    <td className={`${tdCls} text-right`}>{du.toFixed(2)}</td>
                    <td className={`${tdCls} text-right`}>{paye.toFixed(2)}</td>
                    <td
                      className={`${tdCls} text-right ${credit < 0 ? "text-destructive" : ""}`}
                    >
                      {credit.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {clientReport.length > 0 &&
                (() => {
                  const totalDu = clientReport.reduce(
                    (s, r) =>
                      s +
                      r.appts.reduce(
                        (ss, a) => ss + (a.annule ? 0 : a.montantDu),
                        0,
                      ),
                    0,
                  );
                  const totalPaye = clientReport.reduce(
                    (s, r) =>
                      s + r.appts.reduce((ss, a) => ss + a.montantPaye, 0),
                    0,
                  );
                  return (
                    <tr className={totalRow}>
                      <td className={tdCls} colSpan={2}>
                        {t("common.total")}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        {clientReport.reduce((s, r) => s + r.appts.length, 0)}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        {totalDu.toFixed(2)}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        {totalPaye.toFixed(2)}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        {(totalPaye - totalDu).toFixed(2)}
                      </td>
                    </tr>
                  );
                })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* 10-year synthesis */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold text-sm text-foreground">
            {t("reports.synthese_annuelle")}
          </h2>
          <div className="flex items-center gap-2">
            <label
              htmlFor="synthese-year"
              className="text-xs text-muted-foreground"
            >
              {t("reports.annee_depart")}
            </label>
            <input
              id="synthese-year"
              type="number"
              value={syntheseStartYear}
              onChange={(e) =>
                setSyntheseStartYear(
                  Math.min(Number(e.target.value), currentYear),
                )
              }
              max={currentYear}
              min={2000}
              className={`${inputCls} w-24 input-no-spinner`}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportHTML("synthese-table", "synthese")}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-muted dark:text-foreground dark:hover:bg-muted"
            >
              {t("reports.btn_exporter_html")}
            </button>
            <button
              type="button"
              onClick={() => exportCSV("synthese-table", "synthese")}
              className="px-2 py-1 text-xs border border-border rounded hover:bg-muted dark:text-foreground dark:hover:bg-muted"
            >
              {t("reports.btn_exporter_csv")}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            id="synthese-table"
            className="w-full border-collapse text-xs bg-card"
            style={{ fontFamily: "Verdana" }}
          >
            <thead>
              <tr className={totalRow}>
                <th className={thCls}>{t("reports.col_annee")}</th>
                <th className={`${thCls} text-right`}>
                  {t("reports.col_revenus")}
                </th>
                <th className={`${thCls} text-right`}>
                  {t("reports.col_rdv")}
                </th>
              </tr>
            </thead>
            <tbody>
              {syntheseRows.map((row, i) => (
                <tr
                  key={row.yr}
                  className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                >
                  <td className={tdCls}>{row.yr}</td>
                  <td className={`${tdCls} text-right`}>
                    {row.revenus.toFixed(2)}
                  </td>
                  <td className={`${tdCls} text-right`}>{row.rdvFaits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
