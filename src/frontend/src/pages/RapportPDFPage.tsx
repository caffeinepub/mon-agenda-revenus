import { useState } from 'react';
import { useGetMonthlyListing, useGetAllAppointments } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { generateMonthlyListingHTML, calculateMonthlyListingRow, type MonthlyListingRow } from '../utils/monthlyListing';

export default function RapportPDFPage() {
  const [selectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(1);

  const { data: monthlyListingData } = useGetMonthlyListing(selectedYear, selectedMonth);
  const { data: allAppointments = [] } = useGetAllAppointments();

  const listings = monthlyListingData?.[0] ?? [];

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // Calculate rows for display
  const calculatedRows: MonthlyListingRow[] = listings.map(client => {
    return calculateMonthlyListingRow(
      client.referenceClient,
      client.nomClient,
      allAppointments,
      selectedYear,
      selectedMonth
    );
  });

  const handleExportHTML = () => {
    const htmlContent = generateMonthlyListingHTML(calculatedRows);

    const fullHTML = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport Mensuel - ${monthNames[selectedMonth - 1]} ${selectedYear}</title>
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
  <h1>Rapport Mensuel - ${monthNames[selectedMonth - 1]} ${selectedYear}</h1>
  ${htmlContent}
</body>
</html>
    `;

    const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-mensuel-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.html`;
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

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Rapport PDF</h1>
          <Button onClick={handleExportHTML} className="gap-2">
            <Download className="h-4 w-4" />
            Exporter en HTML
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Sélectionner la période</CardTitle>
          </CardHeader>
          <CardContent>
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aperçu du rapport - {monthNames[selectedMonth - 1]} {selectedYear}</CardTitle>
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
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
