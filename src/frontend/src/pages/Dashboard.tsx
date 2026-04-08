import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { useStore } from "../store/useStore";
import type { Appointment } from "../types";

function calcRevenusFaitsEtPayes(appts: Appointment[]): number {
  return appts
    .filter((a) => a.fait && !a.annule && a.montantPaye > 0)
    .reduce((sum, a) => sum + a.montantPaye, 0);
}

function calcRdvFaits(appts: Appointment[]): number {
  return appts
    .filter((a) => a.fait && !a.annule)
    .reduce((sum, a) => sum + (a.annule ? 0 : a.montantDu), 0);
}

function calcSommesRecues(appts: Appointment[]): number {
  return appts.reduce((sum, a) => sum + a.montantPaye, 0);
}

export function Dashboard() {
  const { t, tArr } = useTranslation();
  const { appointments } = useStore();
  const [listingYear, setListingYear] = useState(new Date().getFullYear());
  const [listingMonth, setListingMonth] = useState(new Date().getMonth());

  const monthNames = tArr("dashboard.mois");
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Résumé Mensuels — all 12 months of current year
  const resumeRows = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const monthAppts = appointments.filter((a) => {
        const d = new Date(a.date);
        return d.getFullYear() === currentYear && d.getMonth() === m;
      });
      const rdvFaits = calcRdvFaits(monthAppts);
      const revenus = calcRevenusFaitsEtPayes(monthAppts);
      const sommesRecues = calcSommesRecues(monthAppts);
      return { month: m, rdvFaits, revenus, sommesRecues };
    });
  }, [appointments, currentYear]);

  const totalRdvFaits = resumeRows.reduce((s, r) => s + r.rdvFaits, 0);
  const totalRevenus = resumeRows.reduce((s, r) => s + r.revenus, 0);
  const totalSommesRecues = resumeRows.reduce((s, r) => s + r.sommesRecues, 0);

  // Revenu moy mensuel: average of past completed months with revenus > 0
  const pastMonthsWithRevenue = resumeRows.filter(
    (r, i) => i < currentMonth && r.revenus > 0,
  );
  const revenuMoyMensuel =
    pastMonthsWithRevenue.length > 0
      ? pastMonthsWithRevenue.reduce((s, r) => s + r.revenus, 0) /
        pastMonthsWithRevenue.length
      : 0;

  // Dû = total RDV Faits - total Revenus (never negative)
  const du = Math.max(0, totalRdvFaits - totalRevenus);

  // Listing Mensuel
  const listingAppts = useMemo(() => {
    return appointments
      .filter((a) => {
        const d = new Date(a.date);
        return d.getFullYear() === listingYear && d.getMonth() === listingMonth;
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.heureDebut.localeCompare(b.heureDebut),
      );
  }, [appointments, listingYear, listingMonth]);

  const listingTotalDu = listingAppts.reduce(
    (s, a) => s + (a.annule ? 0 : a.montantDu),
    0,
  );
  const listingTotalPaye = listingAppts.reduce((s, a) => s + a.montantPaye, 0);

  const thCls =
    "border border-border px-2 py-1 text-left text-xs font-semibold";
  const tdCls = "border border-border px-2 py-1 text-xs";
  const totalRowCls = "bg-primary/15 font-semibold";

  return (
    <div
      className="p-4 space-y-6"
      style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
    >
      {/* Résumé Mensuels */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs">
        <div className="px-4 py-2 bg-muted/40 border-b border-border">
          <h2 className="font-bold text-sm text-foreground">
            {t("dashboard.titre_resume")} {currentYear}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-xs"
            style={{ fontFamily: "Verdana" }}
          >
            <thead>
              <tr className={totalRowCls}>
                <th className={thCls}>{t("dashboard.col_mois")}</th>
                <th className={`${thCls} text-right`}>
                  {t("dashboard.col_rdv_faits")}
                </th>
                <th className={`${thCls} text-right`}>
                  {t("dashboard.col_revenus")}
                </th>
                <th className={`${thCls} text-right`}>
                  {t("dashboard.col_sommes_recues")}
                </th>
                <th className={`${thCls} text-right`}>
                  {t("dashboard.col_revenu_moyen")}
                </th>
                <th className={`${thCls} text-right`}>
                  {t("dashboard.col_du")}
                </th>
              </tr>
            </thead>
            <tbody>
              {resumeRows.map((row, i) => (
                <tr
                  key={monthNames[i]}
                  className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                >
                  <td className={tdCls}>{monthNames[i]}</td>
                  <td className={`${tdCls} text-right`}>
                    {row.rdvFaits.toFixed(2)}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {row.revenus.toFixed(2)}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {row.sommesRecues.toFixed(2)}
                  </td>
                  <td className={`${tdCls} text-right`} />
                  <td className={`${tdCls} text-right`} />
                </tr>
              ))}
              {/* Total row */}
              <tr className={totalRowCls}>
                <td className={tdCls}>{t("dashboard.total")}</td>
                <td className={`${tdCls} text-right`}>
                  {totalRdvFaits.toFixed(2)}
                </td>
                <td className={`${tdCls} text-right`}>
                  {totalRevenus.toFixed(2)}
                </td>
                <td className={`${tdCls} text-right`}>
                  {totalSommesRecues.toFixed(2)}
                </td>
                <td className={`${tdCls} text-right`}>
                  {revenuMoyMensuel.toFixed(2)}
                </td>
                <td
                  className={`${tdCls} text-right text-destructive font-bold`}
                >
                  {du.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Listing Mensuel */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs">
        <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center gap-2">
          <h2 className="font-bold text-sm text-foreground flex-1">
            {t("dashboard.titre_listing")} — {monthNames[listingMonth]}{" "}
            {listingYear}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (listingMonth === 0) {
                setListingMonth(11);
                setListingYear((y) => y - 1);
              } else setListingMonth((m) => m - 1);
            }}
            className="p-1 hover:bg-muted rounded"
            aria-label={t("calendar.navigation_precedent")}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setListingMonth(currentMonth);
              setListingYear(currentYear);
            }}
            className="px-2 py-0.5 text-xs border border-border rounded hover:bg-muted"
          >
            {t("dashboard.btn_aujourd_hui")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (listingMonth === 11) {
                setListingMonth(0);
                setListingYear((y) => y + 1);
              } else setListingMonth((m) => m + 1);
            }}
            className="p-1 hover:bg-muted rounded"
            aria-label={t("calendar.navigation_suivant")}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-xs"
            style={{ fontFamily: "Verdana" }}
          >
            <thead>
              <tr className={totalRowCls}>
                <th className={thCls}>{t("dashboard.col_date")}</th>
                <th className={thCls}>{t("dashboard.col_client")}</th>
                <th className={thCls}>{t("dashboard.col_ref")}</th>
                <th className={thCls}>{t("dashboard.col_heure")}</th>
                <th className={`${thCls} text-center`}>
                  {t("dashboard.col_fait")}
                </th>
                <th className={`${thCls} text-center`}>
                  {t("dashboard.col_annule")}
                </th>
                <th className={`${thCls} text-right`}>
                  {t("dashboard.col_du")}
                </th>
                <th className={`${thCls} text-right`}>
                  {t("dashboard.col_paye")}
                </th>
                <th className={thCls}>{t("dashboard.col_note")}</th>
              </tr>
            </thead>
            <tbody>
              {listingAppts.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className={`${tdCls} text-center text-muted-foreground py-4`}
                  >
                    {t("common.aucun_resultat")}
                  </td>
                </tr>
              )}
              {listingAppts.map((appt, i) => {
                const name =
                  [appt.clientPrenom, appt.clientNom]
                    .filter(Boolean)
                    .join(", ") || appt.clientRef;
                const du = appt.annule ? 0 : appt.montantDu;
                return (
                  <tr
                    key={appt.id}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className={tdCls}>{appt.date}</td>
                    <td className={tdCls}>{name}</td>
                    <td className={tdCls}>{appt.clientRef}</td>
                    <td className={tdCls}>{appt.heureDebut}</td>
                    <td className={`${tdCls} text-center`}>
                      {appt.fait ? "✓" : ""}
                    </td>
                    <td className={`${tdCls} text-center`}>
                      {appt.annule ? "✓" : ""}
                    </td>
                    <td className={`${tdCls} text-right`}>{du.toFixed(2)}</td>
                    <td className={`${tdCls} text-right`}>
                      {appt.montantPaye.toFixed(2)}
                    </td>
                    <td className={tdCls}>{appt.note}</td>
                  </tr>
                );
              })}
              {/* Totals */}
              <tr className={totalRowCls}>
                <td className={tdCls} colSpan={6}>
                  {t("dashboard.total")}
                </td>
                <td className={`${tdCls} text-right`}>
                  {listingTotalDu.toFixed(2)}
                </td>
                <td className={`${tdCls} text-right`}>
                  {listingTotalPaye.toFixed(2)}
                </td>
                <td className={tdCls} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
