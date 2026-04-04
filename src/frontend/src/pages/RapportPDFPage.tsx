import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import type { RendezVous } from "../backend";
import {
  useGetAllAppointments,
  useGetAllClientRecords,
  useGetMonthlyListing,
} from "../hooks/useQueries";
import {
  type MonthlyListingRow,
  calculateMonthlyListingRow,
  calculateTotalRevenusFaitsEtPayes,
} from "../utils/monthlyListing";

type ReportType = "mensuel" | "annuel" | "plage";

const AVAILABLE_YEARS = [2022, 2023, 2024, 2025, 2026];

const monthNames = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// ── Synthèse helpers ──────────────────────────────────────────────────────────

const MONTH_LABELS = [
  "Janv",
  "Fév",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Sept",
  "Oct",
  "Nov",
  "Déc",
];

function formatSyntheseAmount(value: bigint): string {
  if (value === BigInt(0)) return "";
  const num = Number(value);
  return num.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function computeMonthlyRevenuTotal(
  allAppointments: RendezVous[],
  clientRefs: string[],
  year: number,
  month: number,
): bigint {
  if (clientRefs.length === 0) return BigInt(0);
  const rows = clientRefs.map((ref) =>
    calculateMonthlyListingRow(ref, "", allAppointments, year, month),
  );
  return calculateTotalRevenusFaitsEtPayes(rows);
}

interface YearRowData {
  year: number;
  months: bigint[];
  totalAnnee: bigint;
  moyenneMensuelle: bigint;
}

function thStyleSynth(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: "1px solid #aab8cc",
    padding: "6px 4px",
    textAlign: "center",
    fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
    fontSize: "11px",
    fontWeight: "bold",
    lineHeight: "1.3",
    ...extra,
  };
}

function tdStyleSynth(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: "1px solid #ccd6e0",
    padding: "5px 6px",
    fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
    fontSize: "12px",
    ...extra,
  };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RapportPDFPage() {
  const [reportType, setReportType] = useState<ReportType>("mensuel");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [annualYear, setAnnualYear] = useState(2026);

  // Custom date range state
  const today = new Date();
  const firstDayOfYear = `${today.getFullYear()}-01-01`;
  const todayStr = today.toISOString().split("T")[0];
  const [rangeStart, setRangeStart] = useState<string>(firstDayOfYear);
  const [rangeEnd, setRangeEnd] = useState<string>(todayStr);

  const { data: monthlyListingData } = useGetMonthlyListing(
    selectedYear,
    selectedMonth,
  );
  const { data: allAppointments = [] } = useGetAllAppointments();

  const listings = monthlyListingData?.[0] ?? [];

  // Monthly calculated rows (existing logic — untouched)
  const monthlyCalculatedRows: MonthlyListingRow[] = listings.map((client) => {
    return calculateMonthlyListingRow(
      client.referenceClient,
      client.nomClient,
      allAppointments,
      selectedYear,
      selectedMonth,
    );
  });

  // Annual calculated rows: aggregate all 12 months per client
  const annualCalculatedRows: MonthlyListingRow[] = useMemo(() => {
    if (reportType !== "annuel" || allAppointments.length === 0) return [];

    const clientMap = new Map<string, string>();
    const yearStart = new Date(annualYear, 0, 1).getTime();
    const yearEnd = new Date(annualYear + 1, 0, 1).getTime();
    const yearStartNs = BigInt(yearStart) * BigInt(1_000_000);
    const yearEndNs = BigInt(yearEnd) * BigInt(1_000_000);

    for (const apt of allAppointments) {
      if (apt.dateHeure >= yearStartNs && apt.dateHeure < yearEndNs) {
        if (!clientMap.has(apt.referenceClient)) {
          clientMap.set(apt.referenceClient, apt.nomClient);
        }
      }
    }

    const rows: MonthlyListingRow[] = [];

    for (const [referenceClient, nomClient] of clientMap.entries()) {
      let totalNbRendezVousFaits = 0;
      let totalRdvFaits = BigInt(0);
      let totalRevenusFaitsEtPayes = BigInt(0);
      let totalRevenusPlusAvances = BigInt(0);

      for (let month = 1; month <= 12; month++) {
        const monthRow = calculateMonthlyListingRow(
          referenceClient,
          nomClient,
          allAppointments,
          annualYear,
          month,
        );
        totalNbRendezVousFaits += monthRow.nbRendezVousFaits;
        totalRdvFaits += monthRow.rdvFaits;
        totalRevenusFaitsEtPayes += monthRow.revenusFaitsEtPayes;
        totalRevenusPlusAvances += monthRow.revenusPlusAvances;
      }

      const decemberRow = calculateMonthlyListingRow(
        referenceClient,
        nomClient,
        allAppointments,
        annualYear,
        12,
      );

      rows.push({
        referenceClient,
        nomClient,
        nbRendezVousFaits: totalNbRendezVousFaits,
        creditDuMoisPrecedent: BigInt(0),
        rdvFaits: totalRdvFaits,
        revenusFaitsEtPayes: totalRevenusFaitsEtPayes,
        revenusPlusAvances: totalRevenusPlusAvances,
        creditPositif: decemberRow.creditPositif,
        creditNegatif: decemberRow.creditNegatif,
      });
    }

    return rows;
  }, [reportType, annualYear, allAppointments]);

  // Custom date range calculated rows
  const rangeCalculatedRows: MonthlyListingRow[] = useMemo(() => {
    if (reportType !== "plage" || allAppointments.length === 0) return [];
    if (!rangeStart || !rangeEnd) return [];

    const startDate = new Date(rangeStart);
    const endDate = new Date(rangeEnd);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
      return [];
    if (startDate > endDate) return [];

    const startNs = BigInt(startDate.getTime()) * BigInt(1_000_000);
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    const endNs = BigInt(endOfDay.getTime()) * BigInt(1_000_000);

    const clientMap = new Map<string, string>();
    for (const apt of allAppointments) {
      if (apt.dateHeure >= startNs && apt.dateHeure <= endNs) {
        if (!clientMap.has(apt.referenceClient)) {
          clientMap.set(apt.referenceClient, apt.nomClient);
        }
      }
    }

    const monthsInRange: Array<{ year: number; month: number }> = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (cursor <= endMonth) {
      monthsInRange.push({
        year: cursor.getFullYear(),
        month: cursor.getMonth() + 1,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const rows: MonthlyListingRow[] = [];

    for (const [referenceClient, nomClient] of clientMap.entries()) {
      let totalNbRendezVousFaits = 0;
      let totalRdvFaits = BigInt(0);
      let totalRevenusFaitsEtPayes = BigInt(0);
      let totalRevenusPlusAvances = BigInt(0);

      for (const { year, month } of monthsInRange) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

        const effectiveStart = monthStart < startDate ? startDate : monthStart;
        const effectiveEnd = monthEnd > endOfDay ? endOfDay : monthEnd;

        const effectiveStartNs =
          BigInt(effectiveStart.getTime()) * BigInt(1_000_000);
        const effectiveEndNs =
          BigInt(effectiveEnd.getTime()) * BigInt(1_000_000);

        const aptsInWindow = allAppointments.filter(
          (apt) =>
            apt.referenceClient === referenceClient &&
            apt.dateHeure >= effectiveStartNs &&
            apt.dateHeure <= effectiveEndNs,
        );

        const nbFaits = aptsInWindow.filter((apt) => apt.fait).length;
        const rdvFaits = aptsInWindow
          .filter((apt) => apt.fait && !apt.annule)
          .reduce((sum, apt) => sum + apt.montantDu, BigInt(0));
        const revenusPlusAvances = aptsInWindow.reduce(
          (sum, apt) => sum + apt.montantPaye,
          BigInt(0),
        );

        const revenusFaitsEtPayes =
          rdvFaits > BigInt(0) && revenusPlusAvances > BigInt(0)
            ? rdvFaits < revenusPlusAvances
              ? rdvFaits
              : revenusPlusAvances
            : BigInt(0);

        totalNbRendezVousFaits += nbFaits;
        totalRdvFaits += rdvFaits;
        totalRevenusFaitsEtPayes += revenusFaitsEtPayes;
        totalRevenusPlusAvances += revenusPlusAvances;
      }

      const creditRaw = totalRevenusPlusAvances - totalRdvFaits;
      const creditPositif = creditRaw > BigInt(0) ? creditRaw : BigInt(0);
      const creditNegatif = creditRaw < BigInt(0) ? creditRaw : BigInt(0);

      rows.push({
        referenceClient,
        nomClient,
        nbRendezVousFaits: totalNbRendezVousFaits,
        creditDuMoisPrecedent: BigInt(0),
        rdvFaits: totalRdvFaits,
        revenusFaitsEtPayes: totalRevenusFaitsEtPayes,
        revenusPlusAvances: totalRevenusPlusAvances,
        creditPositif,
        creditNegatif,
      });
    }

    return rows;
  }, [reportType, rangeStart, rangeEnd, allAppointments]);

  const calculatedRows =
    reportType === "mensuel"
      ? monthlyCalculatedRows
      : reportType === "annuel"
        ? annualCalculatedRows
        : rangeCalculatedRows;

  const getReportTitle = () => {
    if (reportType === "mensuel") {
      return `Rapport Mensuel - ${monthNames[selectedMonth - 1]} ${selectedYear}`;
    }
    if (reportType === "annuel") {
      return `Rapport Annuel - ${annualYear}`;
    }
    const startLabel = rangeStart
      ? new Date(rangeStart).toLocaleDateString("fr-FR")
      : "...";
    const endLabel = rangeEnd
      ? new Date(rangeEnd).toLocaleDateString("fr-FR")
      : "...";
    return `Rapport du ${startLabel} au ${endLabel}`;
  };

  const handleExportHTMLCombined = () => {
    const reportTitle = getReportTitle();

    // Build the Aperçu du rapport table HTML
    const apercuRows = calculatedRows
      .map((row, i) => {
        const bg = i % 2 === 0 ? "#ffffff" : "#f5f8fc";
        const fmt = (v: bigint) => Number(v).toLocaleString("fr-FR");
        const fmtSigned = (v: bigint) => {
          const n = Number(v);
          const color = n >= 0 ? "green" : "red";
          const sign = n >= 0 ? "+" : "";
          return `<span style="color:${color}">${sign}${n.toLocaleString("fr-FR")}</span>`;
        };
        return `<tr style="background:${bg}">
          <td class="bd p2">${row.referenceClient}</td>
          <td class="bd p2">${row.nomClient}</td>
          <td class="bd p2 r">${row.nbRendezVousFaits}</td>
          <td class="bd p2 r">${fmtSigned(row.creditDuMoisPrecedent)}</td>
          <td class="bd p2 r">${fmt(row.rdvFaits)}</td>
          <td class="bd p2 r">${fmt(row.revenusFaitsEtPayes)}</td>
          <td class="bd p2 r">${fmt(row.revenusPlusAvances)}</td>
          <td class="bd p2 r">${row.creditPositif > BigInt(0) ? fmtSigned(row.creditPositif) : "0"}</td>
          <td class="bd p2 r">${row.creditNegatif < BigInt(0) ? fmtSigned(row.creditNegatif) : "0"}</td>
        </tr>`;
      })
      .join("");

    const totalRdvFaits = calculatedRows.reduce(
      (s, r) => s + r.rdvFaits,
      BigInt(0),
    );
    const totalRevFP = calculatedRows.reduce(
      (s, r) => s + r.revenusFaitsEtPayes,
      BigInt(0),
    );
    const totalRevPA = calculatedRows.reduce(
      (s, r) => s + r.revenusPlusAvances,
      BigInt(0),
    );
    const totalCreditPos = calculatedRows.reduce(
      (s, r) => s + r.creditPositif,
      BigInt(0),
    );
    const totalCreditNeg = calculatedRows.reduce(
      (s, r) => s + r.creditNegatif,
      BigInt(0),
    );
    const totalNbRdv = calculatedRows.reduce(
      (s, r) => s + r.nbRendezVousFaits,
      0,
    );

    const fmtSigned = (v: bigint) => {
      const n = Number(v);
      const color = n >= 0 ? "green" : "red";
      const sign = n >= 0 ? "+" : "";
      return `<span style="color:${color}">${sign}${n.toLocaleString("fr-FR")}</span>`;
    };

    const apercuTableHTML = `
      <h2 style="font-family:Verdana;font-size:14px;text-align:center;margin:24px 0 8px">${reportTitle}</h2>
      <table class="tbl" style="font-family:'Cambria',serif;font-size:10px">
        <thead>
          <tr class="bg-header">
            <th class="bd p2">Réf</th>
            <th class="bd p2">Nom</th>
            <th class="bd p2 r">Nbr</th>
            <th class="bd p2 r">Crédit du mois précédent</th>
            <th class="bd p2 r">RDV Faits (Payés + impayés)</th>
            <th class="bd p2 r">Revenus (Faits et Payés)</th>
            <th class="bd p2 r">Revenus + Avances (RDV Payés + Avances)</th>
            <th class="bd p2 r">Crédit Positif</th>
            <th class="bd p2 r">Crédit Négatif</th>
          </tr>
        </thead>
        <tbody>
          <tr class="total-row">
            <td class="bd p2" colspan="2">TOTAL</td>
            <td class="bd p2 r">${totalNbRdv}</td>
            <td class="bd p2 r">-</td>
            <td class="bd p2 r">${Number(totalRdvFaits).toLocaleString("fr-FR")}</td>
            <td class="bd p2 r">${Number(totalRevFP).toLocaleString("fr-FR")}</td>
            <td class="bd p2 r">${Number(totalRevPA).toLocaleString("fr-FR")}</td>
            <td class="bd p2 r">${fmtSigned(totalCreditPos)}</td>
            <td class="bd p2 r">${fmtSigned(totalCreditNeg)}</td>
          </tr>
          ${apercuRows || `<tr><td colspan="9" style="text-align:center;padding:12px;color:#666">Aucune donnée pour cette période.</td></tr>`}
        </tbody>
      </table>`;

    // Build the Synthèse Annuelle et Mensuelle table HTML
    const synthRows = yearRows
      .map((row, rowIndex) => {
        const bg = rowIndex % 2 === 0 ? "#ffffff" : "#f5f8fc";
        const fmtS = (v: bigint) =>
          v === BigInt(0) ? "" : Number(v).toLocaleString("fr-FR");
        const monthCells = row.months
          .map((v) => `<td class="bd-synth p2-synth r-synth">${fmtS(v)}</td>`)
          .join("");
        const moyAnnCell =
          rowIndex === 0
            ? `<td class="bd-synth p2-synth r-synth bold-cell" rowspan="${yearRows.length}" style="vertical-align:middle;background:#eaf0fb">${fmtS(moyenneAnnuelle)}</td>`
            : "";
        return `<tr style="background:${bg}">
          <td class="bd-synth p2-synth bold-cell" style="text-align:center">${row.year}</td>
          ${monthCells}
          <td class="bd-synth p2-synth r-synth bold-cell">${fmtS(row.totalAnnee)}</td>
          <td class="bd-synth p2-synth r-synth">${fmtS(row.moyenneMensuelle)}</td>
          ${moyAnnCell}
        </tr>`;
      })
      .join("");

    const synthTableHTML = `
      <h2 style="font-family:Verdana;font-size:14px;text-align:center;margin:32px 0 8px">Synthèse Annuelle et Mensuelle</h2>
      <p style="font-family:Verdana;font-size:11px;text-align:center;color:#555;margin-bottom:8px">Période : ${synthStartYear} → ${currentYear}</p>
      <table class="tbl-synth">
        <thead>
          <tr style="background:#dce6f1">
            <th class="bd-synth p2-synth" style="width:60px"></th>
            ${MONTH_LABELS.map((l) => `<th class="bd-synth p2-synth" style="width:70px">${l}</th>`).join("")}
            <th class="bd-synth p2-synth" style="width:90px">Total<br>Année</th>
            <th class="bd-synth p2-synth" style="width:90px">Moyenne<br>Mensuelle</th>
            <th class="bd-synth p2-synth" style="width:90px">Moyenne<br>Annuelle</th>
          </tr>
        </thead>
        <tbody>
          ${synthRows || `<tr><td colspan="16" style="text-align:center;padding:20px;color:#666">Aucune donnée à afficher</td></tr>`}
        </tbody>
      </table>
      <div style="font-family:Verdana;font-size:11px;color:#666;margin-top:8px">
        <p>* Les montants correspondent aux « Revenus (Faits et Payés) » du Listing Mensuel.</p>
        <p>* Moyenne Mensuelle : pour l'année en cours, seuls les mois terminés sont pris en compte.</p>
        <p>* Moyenne Annuelle : somme des montants de la colonne « Total Année » divisée par le nombre d'années ayant un montant.</p>
      </div>`;

    const fullHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle} — Synthèse</title>
  <style>
    body { font-family: Verdana, Geneva, Tahoma, sans-serif; margin: 20px; font-size: 10px; }
    .tbl { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .tbl-synth { width: 100%; border-collapse: collapse; margin-top: 8px; min-width: 1100px; font-family: Verdana, Geneva, Tahoma, sans-serif; font-size: 12px; }
    .bd { border: 1px solid #333; }
    .p2 { padding: 6px 8px; }
    .r { text-align: right; }
    .bg-header { background-color: #dce6f1; font-weight: bold; }
    .total-row { background-color: #e8e8e8; font-weight: bold; }
    .positive { color: green; }
    .negative { color: red; }
    .bd-synth { border: 1px solid #ccd6e0; }
    .p2-synth { padding: 5px 6px; }
    .r-synth { text-align: right; }
    .bold-cell { font-weight: bold; }
    th.bd-synth { border: 1px solid #aab8cc; text-align: center; font-weight: bold; font-size: 11px; line-height: 1.3; }
  </style>
</head>
<body>
  ${apercuTableHTML}
  ${synthTableHTML}
</body>
</html>`;

    const blob = new Blob([fullHTML], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    let filename: string;
    if (reportType === "mensuel") {
      filename = `rapport-mensuel-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.html`;
    } else if (reportType === "annuel") {
      filename = `rapport-annuel-${annualYear}.html`;
    } else {
      filename = `rapport-plage-${rangeStart}-au-${rangeEnd}.html`;
    }
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatNumber = (amount: bigint | number) => {
    return Number(amount).toLocaleString("fr-FR");
  };

  const formatBalance = (balance: bigint) => {
    const numBalance = Number(balance);
    const isPositive = numBalance >= 0;
    const className = isPositive
      ? "text-green-600 font-semibold"
      : "text-red-600 font-semibold";
    const sign = isPositive ? "+" : "";
    return (
      <span className={className}>
        {sign}
        {numBalance.toLocaleString("fr-FR")}
      </span>
    );
  };

  const handleExportCSV = () => {
    const fmtNum = (v: bigint) => String(Number(v));
    const fmtSigned = (v: bigint) => {
      const n = Number(v);
      return n >= 0 ? `+${n}` : String(n);
    };

    const totalNbRdv = calculatedRows.reduce(
      (s, r) => s + r.nbRendezVousFaits,
      0,
    );
    const totalRdvFaits = calculatedRows.reduce(
      (s, r) => s + r.rdvFaits,
      BigInt(0),
    );
    const totalRevFP = calculatedRows.reduce(
      (s, r) => s + r.revenusFaitsEtPayes,
      BigInt(0),
    );
    const totalRevPA = calculatedRows.reduce(
      (s, r) => s + r.revenusPlusAvances,
      BigInt(0),
    );
    const totalCreditPos = calculatedRows.reduce(
      (s, r) => s + r.creditPositif,
      BigInt(0),
    );
    const totalCreditNeg = calculatedRows.reduce(
      (s, r) => s + r.creditNegatif,
      BigInt(0),
    );

    const headers = [
      "Réf",
      "Nom",
      "Nbr",
      "Crédit du mois précédent",
      "RDV Faits (Payés + impayés)",
      "Revenus (Faits et Payés)",
      "Revenus + Avances (RDV Payés + Avances)",
      "Crédit Positif",
      "Crédit Négatif",
    ];

    const totalRow = [
      "TOTAL",
      "",
      String(totalNbRdv),
      "-",
      fmtNum(totalRdvFaits),
      fmtNum(totalRevFP),
      fmtNum(totalRevPA),
      fmtSigned(totalCreditPos),
      fmtSigned(totalCreditNeg),
    ];

    const dataRows = calculatedRows.map((row) => [
      row.referenceClient,
      row.nomClient,
      String(row.nbRendezVousFaits),
      fmtSigned(row.creditDuMoisPrecedent),
      fmtNum(row.rdvFaits),
      fmtNum(row.revenusFaitsEtPayes),
      fmtNum(row.revenusPlusAvances),
      row.creditPositif > BigInt(0) ? fmtSigned(row.creditPositif) : "0",
      row.creditNegatif < BigInt(0) ? fmtSigned(row.creditNegatif) : "0",
    ]);

    const csvContent = [headers, totalRow, ...dataRows]
      .map((r) => r.map((cell) => `"${cell}"`).join(";"))
      .join("\n");

    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    let filename: string;
    if (reportType === "mensuel") {
      filename = `rapport-mensuel-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`;
    } else if (reportType === "annuel") {
      filename = `rapport-annuel-${annualYear}.csv`;
    } else {
      filename = `rapport-plage-${rangeStart}-au-${rangeEnd}.csv`;
    }
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const previewTitle =
    reportType === "mensuel"
      ? `Aperçu du rapport - ${monthNames[selectedMonth - 1]} ${selectedYear}`
      : reportType === "annuel"
        ? `Aperçu du rapport annuel - ${annualYear}`
        : `Aperçu du rapport - ${rangeStart ? new Date(rangeStart).toLocaleDateString("fr-FR") : "..."} au ${rangeEnd ? new Date(rangeEnd).toLocaleDateString("fr-FR") : "..."}`;

  const isRangeValid =
    reportType !== "plage" ||
    (!!rangeStart &&
      !!rangeEnd &&
      !Number.isNaN(new Date(rangeStart).getTime()) &&
      !Number.isNaN(new Date(rangeEnd).getTime()) &&
      new Date(rangeStart) <= new Date(rangeEnd));

  // ── Synthèse section state ─────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [synthStartYearInput, setSynthStartYearInput] = useState<string>(
    String(currentYear - 1),
  );

  const synthStartYear = useMemo(() => {
    const parsed = Number.parseInt(synthStartYearInput, 10);
    if (Number.isNaN(parsed) || parsed > currentYear) return currentYear;
    if (parsed < 1900) return 1900;
    return parsed;
  }, [synthStartYearInput, currentYear]);

  const { data: clientRecords = [], isLoading: clientsLoading } =
    useGetAllClientRecords();

  const isSynthLoading = clientsLoading;

  const clientRefs = useMemo(() => {
    return clientRecords.map((cr) => cr.referenceClient);
  }, [clientRecords]);

  const synthYears = useMemo(() => {
    const result: number[] = [];
    for (let y = synthStartYear; y <= currentYear; y++) {
      result.push(y);
    }
    return result;
  }, [synthStartYear, currentYear]);

  const yearRows = useMemo((): YearRowData[] => {
    if (isSynthLoading) return [];

    return synthYears.map((year) => {
      const isPastYear = year < currentYear;
      const monthValues: bigint[] = [];
      for (let m = 1; m <= 12; m++) {
        const val = computeMonthlyRevenuTotal(
          allAppointments,
          clientRefs,
          year,
          m,
        );
        monthValues.push(val);
      }

      const totalAnnee = monthValues.reduce((sum, v) => sum + v, BigInt(0));

      let moyenneMensuelle = BigInt(0);
      if (isPastYear) {
        const nonZeroMonths = monthValues.filter((v) => v > BigInt(0));
        if (nonZeroMonths.length > 0) {
          const sum = nonZeroMonths.reduce((s, v) => s + v, BigInt(0));
          moyenneMensuelle = BigInt(
            Math.round(Number(sum) / nonZeroMonths.length),
          );
        }
      } else {
        const completedMonthValues = monthValues.slice(0, currentMonth - 1);
        const nonZeroCompleted = completedMonthValues.filter(
          (v) => v > BigInt(0),
        );
        if (nonZeroCompleted.length > 0) {
          const sum = nonZeroCompleted.reduce((s, v) => s + v, BigInt(0));
          moyenneMensuelle = BigInt(
            Math.round(Number(sum) / nonZeroCompleted.length),
          );
        }
      }

      return { year, months: monthValues, totalAnnee, moyenneMensuelle };
    });
  }, [
    synthYears,
    allAppointments,
    clientRefs,
    currentYear,
    currentMonth,
    isSynthLoading,
  ]);

  const moyenneAnnuelle = useMemo(() => {
    const rowsWithAmount = yearRows.filter((r) => r.totalAnnee > BigInt(0));
    if (rowsWithAmount.length === 0) return BigInt(0);
    const sum = rowsWithAmount.reduce((s, r) => s + r.totalAnnee, BigInt(0));
    return BigInt(Math.round(Number(sum) / rowsWithAmount.length));
  }, [yearRows]);

  const numRows = synthYears.length;

  function exportSyntheseCSV() {
    const headers = [
      "Année",
      ...MONTH_LABELS,
      "Total Année",
      "Moyenne Mensuelle",
    ];
    const rows = yearRows.map((row) => [
      String(row.year),
      ...row.months.map((v) => (v === BigInt(0) ? "" : String(Number(v)))),
      row.totalAnnee === BigInt(0) ? "" : String(Number(row.totalAnnee)),
      row.moyenneMensuelle === BigInt(0)
        ? ""
        : String(Number(row.moyenneMensuelle)),
    ]);
    rows.push([
      "Moyenne Annuelle",
      ...Array(12).fill(""),
      "",
      moyenneAnnuelle === BigInt(0) ? "" : String(Number(moyenneAnnuelle)),
    ]);

    const csvContent = [headers, ...rows]
      .map((r) => r.map((cell) => `"${cell}"`).join(";"))
      .join("\n");

    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `synthese_${synthStartYear}_${currentYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Rapport PDF</h1>
          <div className="flex gap-2">
            <Button
              onClick={handleExportCSV}
              className="gap-2"
              disabled={!isRangeValid}
              variant="outline"
              data-ocid="rapport.export_csv.button"
            >
              <Download className="h-4 w-4" />
              Exporter en CSV
            </Button>
            <Button
              onClick={handleExportHTMLCombined}
              className="gap-2"
              disabled={!isRangeValid}
              data-ocid="rapport.export_html.button"
            >
              <Download className="h-4 w-4" />
              Exporter en HTML
            </Button>
          </div>
        </div>

        {/* Report type selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Type de rapport</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reportType"
                  value="mensuel"
                  checked={reportType === "mensuel"}
                  onChange={() => setReportType("mensuel")}
                  className="accent-primary w-4 h-4"
                />
                <span className="font-medium">Rapport Mensuel</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reportType"
                  value="annuel"
                  checked={reportType === "annuel"}
                  onChange={() => setReportType("annuel")}
                  className="accent-primary w-4 h-4"
                />
                <span className="font-medium">Rapport Annuel</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reportType"
                  value="plage"
                  checked={reportType === "plage"}
                  onChange={() => setReportType("plage")}
                  className="accent-primary w-4 h-4"
                />
                <span className="font-medium">Plage de dates</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Period selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Sélectionner la période</CardTitle>
          </CardHeader>
          <CardContent>
            {reportType === "mensuel" && (
              <div className="flex gap-4">
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(v) => setSelectedMonth(Number.parseInt(v))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((name) => {
                      const monthNum = monthNames.indexOf(name) + 1;
                      return (
                        <SelectItem key={name} value={monthNum.toString()}>
                          {name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(v) => setSelectedYear(Number.parseInt(v))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportType === "annuel" && (
              <div className="flex gap-4">
                <Select
                  value={annualYear.toString()}
                  onValueChange={(v) => setAnnualYear(Number.parseInt(v))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportType === "plage" && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="range-start">Date de début</Label>
                  <Input
                    id="range-start"
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="range-end">Date de fin</Label>
                  <Input
                    id="range-end"
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
                {rangeStart &&
                  rangeEnd &&
                  new Date(rangeStart) > new Date(rangeEnd) && (
                    <p className="text-destructive text-sm self-end pb-2">
                      La date de début doit être antérieure à la date de fin.
                    </p>
                  )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aperçu du rapport */}
        <Card>
          <CardHeader>
            <CardTitle>{previewTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse"
                style={{ fontFamily: "Cambria, serif", fontSize: "10px" }}
              >
                <thead>
                  <tr className="bg-muted">
                    <th className="border p-2 text-left">Réf</th>
                    <th className="border p-2 text-left">Nom</th>
                    <th className="border p-2 text-right">Nbr</th>
                    <th className="border p-2 text-right">
                      Crédit du mois précédent
                    </th>
                    <th className="border p-2 text-right">
                      RDV Faits (Payés + impayés)
                    </th>
                    <th className="border p-2 text-right">
                      Revenus (Faits et Payés)
                    </th>
                    <th className="border p-2 text-right">
                      Revenus + Avances (RDV Payés + Avances)
                    </th>
                    <th className="border p-2 text-right">Crédit Positif</th>
                    <th className="border p-2 text-right">Crédit Négatif</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-muted/50 font-bold">
                    <td colSpan={2} className="border p-2">
                      TOTAL
                    </td>
                    <td className="border p-2 text-right">
                      {calculatedRows.reduce(
                        (sum, r) => sum + r.nbRendezVousFaits,
                        0,
                      )}
                    </td>
                    <td className="border p-2 text-right">-</td>
                    <td className="border p-2 text-right">
                      {formatNumber(
                        calculatedRows.reduce(
                          (sum, r) => sum + r.rdvFaits,
                          BigInt(0),
                        ),
                      )}
                    </td>
                    <td className="border p-2 text-right">
                      {formatNumber(
                        calculatedRows.reduce(
                          (sum, r) => sum + r.revenusFaitsEtPayes,
                          BigInt(0),
                        ),
                      )}
                    </td>
                    <td className="border p-2 text-right">
                      {formatNumber(
                        calculatedRows.reduce(
                          (sum, r) => sum + r.revenusPlusAvances,
                          BigInt(0),
                        ),
                      )}
                    </td>
                    <td className="border p-2 text-right">
                      {formatBalance(
                        calculatedRows.reduce(
                          (sum, r) => sum + r.creditPositif,
                          BigInt(0),
                        ),
                      )}
                    </td>
                    <td className="border p-2 text-right">
                      {formatBalance(
                        calculatedRows.reduce(
                          (sum, r) => sum + r.creditNegatif,
                          BigInt(0),
                        ),
                      )}
                    </td>
                  </tr>
                  {calculatedRows.map((row) => (
                    <tr key={row.referenceClient}>
                      <td className="border p-2">{row.referenceClient}</td>
                      <td className="border p-2">{row.nomClient}</td>
                      <td className="border p-2 text-right">
                        {row.nbRendezVousFaits}
                      </td>
                      <td className="border p-2 text-right">
                        {formatBalance(row.creditDuMoisPrecedent)}
                      </td>
                      <td className="border p-2 text-right">
                        {formatNumber(row.rdvFaits)}
                      </td>
                      <td className="border p-2 text-right">
                        {formatNumber(row.revenusFaitsEtPayes)}
                      </td>
                      <td className="border p-2 text-right">
                        {formatNumber(row.revenusPlusAvances)}
                      </td>
                      <td className="border p-2 text-right">
                        {row.creditPositif > BigInt(0)
                          ? formatBalance(row.creditPositif)
                          : "0"}
                      </td>
                      <td className="border p-2 text-right">
                        {row.creditNegatif < BigInt(0)
                          ? formatBalance(row.creditNegatif)
                          : "0"}
                      </td>
                    </tr>
                  ))}
                  {calculatedRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="border p-4 text-center text-muted-foreground"
                      >
                        {reportType === "plage" && !isRangeValid
                          ? "Veuillez sélectionner une plage de dates valide."
                          : "Aucune donnée pour cette période."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Synthèse Annuelle et Mensuelle (cloné depuis page Synthèse) ── */}
        <div
          style={{ fontFamily: "Verdana, Geneva, Tahoma, sans-serif" }}
          className="mt-10"
        >
          {/* Year Input Section */}
          <div
            className="mb-6 flex flex-wrap items-center gap-4 rounded border border-border bg-card p-4"
            style={{ fontFamily: "Verdana, Geneva, Tahoma, sans-serif" }}
          >
            <label
              htmlFor="synthStartYearRapport"
              style={{
                fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
                fontSize: "13px",
                fontWeight: "bold",
              }}
              className="text-foreground"
            >
              Année de départ de la synthèse :
            </label>
            <input
              id="synthStartYearRapport"
              data-ocid="rapport.synth_start_year.input"
              type="number"
              min={1900}
              max={currentYear}
              value={synthStartYearInput}
              onChange={(e) => {
                setSynthStartYearInput(e.target.value);
              }}
              onBlur={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(parsed) && parsed > currentYear) {
                  setSynthStartYearInput(String(currentYear));
                } else if (!Number.isNaN(parsed) && parsed < 1900) {
                  setSynthStartYearInput("1900");
                }
              }}
              style={{
                fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
                fontSize: "13px",
                width: "90px",
                padding: "4px 8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <span
              style={{
                fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
                fontSize: "13px",
              }}
              className="text-muted-foreground"
            >
              Période affichée : {synthStartYear} → {currentYear}
            </span>

            {/* Export button */}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                data-ocid="rapport.synth_export_csv.button"
                onClick={exportSyntheseCSV}
                disabled={isSynthLoading || yearRows.length === 0}
                style={{
                  fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
                  fontSize: "12px",
                  fontWeight: "bold",
                  padding: "5px 12px",
                  border: "1px solid #2a7a2a",
                  borderRadius: "4px",
                  backgroundColor: "#e8f5e9",
                  color: "#2a7a2a",
                  cursor:
                    isSynthLoading || yearRows.length === 0
                      ? "not-allowed"
                      : "pointer",
                  opacity: isSynthLoading || yearRows.length === 0 ? 0.5 : 1,
                }}
              >
                ↓ Exporter CSV
              </button>
            </div>
          </div>

          {/* Table Section */}
          <div className="mb-4">
            <h2
              style={{
                fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
                fontSize: "16px",
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: "12px",
              }}
              className="text-foreground"
            >
              Synthèse Annuelle et Mensuelle
            </h2>

            {isSynthLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <span
                  style={{
                    fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
                    fontSize: "13px",
                  }}
                  className="ml-3 text-muted-foreground"
                >
                  Chargement des données...
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  style={{
                    fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
                    fontSize: "12px",
                    borderCollapse: "collapse",
                    width: "100%",
                    minWidth: "1100px",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#dce6f1" }}>
                      <th style={thStyleSynth({ width: "60px" })} />
                      {MONTH_LABELS.map((label) => (
                        <th key={label} style={thStyleSynth({ width: "70px" })}>
                          {label}
                        </th>
                      ))}
                      <th style={thStyleSynth({ width: "90px" })}>
                        Total
                        <br />
                        Année
                      </th>
                      <th style={thStyleSynth({ width: "90px" })}>
                        Moyenne
                        <br />
                        Mensuelle
                      </th>
                      <th style={thStyleSynth({ width: "90px" })}>
                        Moyenne
                        <br />
                        Annuelle
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {numRows === 0 ? (
                      <tr>
                        <td
                          colSpan={16}
                          style={{
                            textAlign: "center",
                            padding: "20px",
                            fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
                            fontSize: "12px",
                            color: "#666",
                            border: "1px solid #ccc",
                          }}
                        >
                          Aucune donnée à afficher
                        </td>
                      </tr>
                    ) : (
                      yearRows.map((row, rowIndex) => (
                        <tr
                          key={row.year}
                          style={{
                            backgroundColor:
                              rowIndex % 2 === 0 ? "#ffffff" : "#f5f8fc",
                          }}
                        >
                          {/* Year column */}
                          <td
                            style={tdStyleSynth({
                              fontWeight: "bold",
                              textAlign: "center",
                            })}
                          >
                            {row.year}
                          </td>

                          {/* 12 monthly columns */}
                          {row.months.map((val, mIdx) => (
                            <td
                              key={MONTH_LABELS[mIdx]}
                              style={tdStyleSynth({ textAlign: "right" })}
                            >
                              {formatSyntheseAmount(val)}
                            </td>
                          ))}

                          {/* Total Année */}
                          <td
                            style={tdStyleSynth({
                              textAlign: "right",
                              fontWeight: "bold",
                            })}
                          >
                            {formatSyntheseAmount(row.totalAnnee)}
                          </td>

                          {/* Moyenne Mensuelle */}
                          <td style={tdStyleSynth({ textAlign: "right" })}>
                            {formatSyntheseAmount(row.moyenneMensuelle)}
                          </td>

                          {/* Moyenne Annuelle - only rendered in first row with rowspan */}
                          {rowIndex === 0 && (
                            <td
                              rowSpan={numRows}
                              style={{
                                ...tdStyleSynth({
                                  textAlign: "right",
                                  fontWeight: "bold",
                                }),
                                verticalAlign: "middle",
                                backgroundColor: "#eaf0fb",
                              }}
                            >
                              {formatSyntheseAmount(moyenneAnnuelle)}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Legend */}
          <div
            style={{
              fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
              fontSize: "11px",
            }}
            className="mt-4 text-muted-foreground"
          >
            <p>
              * Les montants correspondent aux « Revenus (Faits et Payés) » du
              Listing Mensuel.
            </p>
            <p>
              * Moyenne Mensuelle : pour l'année en cours, seuls les mois
              terminés (avant le mois actuel) sont pris en compte.
            </p>
            <p>
              * Moyenne Annuelle : somme des montants de la colonne « Total
              Année » divisée par le nombre d'années ayant un montant.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
