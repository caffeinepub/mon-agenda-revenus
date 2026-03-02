import { useState, useMemo } from 'react';
import { useGetMonthlyListing, useGetAllAppointments } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import { generateMonthlyListingHTML, calculateMonthlyListingRow, type MonthlyListingRow } from '../utils/monthlyListing';

type ReportType = 'mensuel' | 'annuel' | 'plage';

const AVAILABLE_YEARS = [2022, 2023, 2024, 2025, 2026];

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function RapportPDFPage() {
  const [reportType, setReportType] = useState<ReportType>('mensuel');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [annualYear, setAnnualYear] = useState(2026);

  // Custom date range state
  const today = new Date();
  const firstDayOfYear = `${today.getFullYear()}-01-01`;
  const todayStr = today.toISOString().split('T')[0];
  const [rangeStart, setRangeStart] = useState<string>(firstDayOfYear);
  const [rangeEnd, setRangeEnd] = useState<string>(todayStr);

  const { data: monthlyListingData } = useGetMonthlyListing(selectedYear, selectedMonth);
  const { data: allAppointments = [] } = useGetAllAppointments();

  const listings = monthlyListingData?.[0] ?? [];

  // Monthly calculated rows (existing logic — untouched)
  const monthlyCalculatedRows: MonthlyListingRow[] = listings.map(client => {
    return calculateMonthlyListingRow(
      client.referenceClient,
      client.nomClient,
      allAppointments,
      selectedYear,
      selectedMonth
    );
  });

  // Annual calculated rows: aggregate all 12 months per client
  const annualCalculatedRows: MonthlyListingRow[] = useMemo(() => {
    if (reportType !== 'annuel' || allAppointments.length === 0) return [];

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
          month
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
        12
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
    if (reportType !== 'plage' || allAppointments.length === 0) return [];
    if (!rangeStart || !rangeEnd) return [];

    const startDate = new Date(rangeStart);
    const endDate = new Date(rangeEnd);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return [];
    if (startDate > endDate) return [];

    // Convert to nanoseconds for comparison
    const startNs = BigInt(startDate.getTime()) * BigInt(1_000_000);
    // End of the end date (inclusive: end of day)
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    const endNs = BigInt(endOfDay.getTime()) * BigInt(1_000_000);

    // Collect all unique clients that have appointments in the range
    const clientMap = new Map<string, string>();
    for (const apt of allAppointments) {
      if (apt.dateHeure >= startNs && apt.dateHeure <= endNs) {
        if (!clientMap.has(apt.referenceClient)) {
          clientMap.set(apt.referenceClient, apt.nomClient);
        }
      }
    }

    // Determine which year/month combinations fall within the range
    // We iterate month by month from startDate to endDate
    const monthsInRange: Array<{ year: number; month: number }> = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (cursor <= endMonth) {
      monthsInRange.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const rows: MonthlyListingRow[] = [];

    for (const [referenceClient, nomClient] of clientMap.entries()) {
      let totalNbRendezVousFaits = 0;
      let totalRdvFaits = BigInt(0);
      let totalRevenusFaitsEtPayes = BigInt(0);
      let totalRevenusPlusAvances = BigInt(0);

      for (const { year, month } of monthsInRange) {
        // Filter appointments for this client in this month, but only within the range
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

        // Clamp to the user-defined range
        const effectiveStart = monthStart < startDate ? startDate : monthStart;
        const effectiveEnd = monthEnd > endOfDay ? endOfDay : monthEnd;

        const effectiveStartNs = BigInt(effectiveStart.getTime()) * BigInt(1_000_000);
        const effectiveEndNs = BigInt(effectiveEnd.getTime()) * BigInt(1_000_000);

        // Count appointments in this clamped window
        const aptsInWindow = allAppointments.filter(apt =>
          apt.referenceClient === referenceClient &&
          apt.dateHeure >= effectiveStartNs &&
          apt.dateHeure <= effectiveEndNs
        );

        const nbFaits = aptsInWindow.filter(apt => apt.fait).length;
        const rdvFaits = aptsInWindow
          .filter(apt => apt.fait && !apt.annule)
          .reduce((sum, apt) => sum + apt.montantDu, BigInt(0));
        const revenusPlusAvances = aptsInWindow
          .reduce((sum, apt) => sum + apt.montantPaye, BigInt(0));

        // Revenus faits et payés: MIN(rdvFaits, revenusPlusAvances) when both > 0
        const revenusFaitsEtPayes = rdvFaits > BigInt(0) && revenusPlusAvances > BigInt(0)
          ? rdvFaits < revenusPlusAvances ? rdvFaits : revenusPlusAvances
          : BigInt(0);

        totalNbRendezVousFaits += nbFaits;
        totalRdvFaits += rdvFaits;
        totalRevenusFaitsEtPayes += revenusFaitsEtPayes;
        totalRevenusPlusAvances += revenusPlusAvances;
      }

      // Credit: difference between total paid and total due
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
    reportType === 'mensuel' ? monthlyCalculatedRows :
    reportType === 'annuel' ? annualCalculatedRows :
    rangeCalculatedRows;

  const getReportTitle = () => {
    if (reportType === 'mensuel') {
      return `Rapport Mensuel - ${monthNames[selectedMonth - 1]} ${selectedYear}`;
    } else if (reportType === 'annuel') {
      return `Rapport Annuel - ${annualYear}`;
    } else {
      const startLabel = rangeStart ? new Date(rangeStart).toLocaleDateString('fr-FR') : '...';
      const endLabel = rangeEnd ? new Date(rangeEnd).toLocaleDateString('fr-FR') : '...';
      return `Rapport du ${startLabel} au ${endLabel}`;
    }
  };

  const handleExportHTML = () => {
    const htmlContent = generateMonthlyListingHTML(calculatedRows);
    const reportTitle = getReportTitle();

    const fullHTML = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    body {
      font-family: 'Cambria', serif;
      margin: 20px;
      font-size: 10px;
    }
    h1 {
      text-align: center;
      margin-bottom: 20px;
    }
    table.monthly-listing {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    table.monthly-listing th,
    table.monthly-listing td {
      border: 1px solid #333;
      padding: 6px 8px;
      text-align: left;
    }
    table.monthly-listing th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    table.monthly-listing td.number,
    table.monthly-listing th.number {
      text-align: right;
    }
    table.monthly-listing tr.total-row {
      background-color: #e8e8e8;
      font-weight: bold;
    }
    .positive {
      color: green;
    }
    .negative {
      color: red;
    }
  </style>
</head>
<body>
  <h1>${reportTitle}</h1>
  ${htmlContent}
</body>
</html>
    `;

    const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    let filename: string;
    if (reportType === 'mensuel') {
      filename = `rapport-mensuel-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.html`;
    } else if (reportType === 'annuel') {
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
    return Number(amount).toLocaleString('fr-FR');
  };

  const formatBalance = (balance: bigint) => {
    const numBalance = Number(balance);
    const isPositive = numBalance >= 0;
    const className = isPositive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
    const sign = isPositive ? '+' : '';
    return (
      <span className={className}>
        {sign}{numBalance.toLocaleString('fr-FR')}
      </span>
    );
  };

  const previewTitle = reportType === 'mensuel'
    ? `Aperçu du rapport - ${monthNames[selectedMonth - 1]} ${selectedYear}`
    : reportType === 'annuel'
    ? `Aperçu du rapport annuel - ${annualYear}`
    : `Aperçu du rapport - ${rangeStart ? new Date(rangeStart).toLocaleDateString('fr-FR') : '...'} au ${rangeEnd ? new Date(rangeEnd).toLocaleDateString('fr-FR') : '...'}`;

  const isRangeValid = reportType !== 'plage' || (
    !!rangeStart && !!rangeEnd &&
    !isNaN(new Date(rangeStart).getTime()) &&
    !isNaN(new Date(rangeEnd).getTime()) &&
    new Date(rangeStart) <= new Date(rangeEnd)
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Rapport PDF</h1>
          <Button onClick={handleExportHTML} className="gap-2" disabled={!isRangeValid}>
            <Download className="h-4 w-4" />
            Exporter en HTML
          </Button>
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
                  checked={reportType === 'mensuel'}
                  onChange={() => setReportType('mensuel')}
                  className="accent-primary w-4 h-4"
                />
                <span className="font-medium">Rapport Mensuel</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reportType"
                  value="annuel"
                  checked={reportType === 'annuel'}
                  onChange={() => setReportType('annuel')}
                  className="accent-primary w-4 h-4"
                />
                <span className="font-medium">Rapport Annuel</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reportType"
                  value="plage"
                  checked={reportType === 'plage'}
                  onChange={() => setReportType('plage')}
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
            {reportType === 'mensuel' && (
              <div className="flex gap-4">
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((name, idx) => (
                      <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
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

            {reportType === 'annuel' && (
              <div className="flex gap-4">
                <Select value={annualYear.toString()} onValueChange={(v) => setAnnualYear(parseInt(v))}>
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

            {reportType === 'plage' && (
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
                {rangeStart && rangeEnd && new Date(rangeStart) > new Date(rangeEnd) && (
                  <p className="text-destructive text-sm self-end pb-2">
                    La date de début doit être antérieure à la date de fin.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{previewTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                <thead>
                  <tr className="bg-muted">
                    <th className="border p-2 text-left">Réf</th>
                    <th className="border p-2 text-left">Nom</th>
                    <th className="border p-2 text-right">Nbr</th>
                    <th className="border p-2 text-right">Crédit du mois précédent</th>
                    <th className="border p-2 text-right">RDV Faits (Payés + impayés)</th>
                    <th className="border p-2 text-right">Revenus (Faits et Payés)</th>
                    <th className="border p-2 text-right">Revenus + Avances (RDV Payés + Avances)</th>
                    <th className="border p-2 text-right">Crédit Positif</th>
                    <th className="border p-2 text-right">Crédit Négatif</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-muted/50 font-bold">
                    <td colSpan={2} className="border p-2">TOTAL</td>
                    <td className="border p-2 text-right">{calculatedRows.reduce((sum, r) => sum + r.nbRendezVousFaits, 0)}</td>
                    <td className="border p-2 text-right">-</td>
                    <td className="border p-2 text-right">{formatNumber(calculatedRows.reduce((sum, r) => sum + r.rdvFaits, BigInt(0)))}</td>
                    <td className="border p-2 text-right">{formatNumber(calculatedRows.reduce((sum, r) => sum + r.revenusFaitsEtPayes, BigInt(0)))}</td>
                    <td className="border p-2 text-right">{formatNumber(calculatedRows.reduce((sum, r) => sum + r.revenusPlusAvances, BigInt(0)))}</td>
                    <td className="border p-2 text-right">{formatBalance(calculatedRows.reduce((sum, r) => sum + r.creditPositif, BigInt(0)))}</td>
                    <td className="border p-2 text-right">{formatBalance(calculatedRows.reduce((sum, r) => sum + r.creditNegatif, BigInt(0)))}</td>
                  </tr>
                  {calculatedRows.map((row) => (
                    <tr key={row.referenceClient}>
                      <td className="border p-2">{row.referenceClient}</td>
                      <td className="border p-2">{row.nomClient}</td>
                      <td className="border p-2 text-right">{row.nbRendezVousFaits}</td>
                      <td className="border p-2 text-right">{formatBalance(row.creditDuMoisPrecedent)}</td>
                      <td className="border p-2 text-right">{formatNumber(row.rdvFaits)}</td>
                      <td className="border p-2 text-right">{formatNumber(row.revenusFaitsEtPayes)}</td>
                      <td className="border p-2 text-right">{formatNumber(row.revenusPlusAvances)}</td>
                      <td className="border p-2 text-right">{row.creditPositif > BigInt(0) ? formatBalance(row.creditPositif) : '0'}</td>
                      <td className="border p-2 text-right">{row.creditNegatif < BigInt(0) ? formatBalance(row.creditNegatif) : '0'}</td>
                    </tr>
                  ))}
                  {calculatedRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="border p-4 text-center text-muted-foreground">
                        {reportType === 'plage' && !isRangeValid
                          ? 'Veuillez sélectionner une plage de dates valide.'
                          : 'Aucune donnée pour cette période.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
