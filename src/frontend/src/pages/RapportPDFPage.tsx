import { useState, useMemo } from 'react';
import { useGetRapportPDF, useGetMonthlyListing, useGetAllAppointments } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText } from 'lucide-react';
import { RapportType } from '../backend';
import MonthlyListingTable from '../components/MonthlyListingTable';
import { calculateRevenusFaitsEtPayesFromListing, calculateTotalRevenusFaitsEtPayes } from '../utils/monthlyListing';

export default function RapportPDFPage() {
  const [rapportType, setRapportType] = useState<'hebdomadaire' | 'mensuel' | 'annuel'>('mensuel');
  const [year, setYear] = useState<number>(2026);
  const [period, setPeriod] = useState<number>(1);

  const { data: rapportData, isLoading } = useGetRapportPDF({
    rapportType: rapportType === 'hebdomadaire' ? RapportType.hebdomadaire : rapportType === 'mensuel' ? RapportType.mensuel : RapportType.annuel,
    year: BigInt(year),
    period: BigInt(period),
  });

  // Fetch monthly listing data for mensuel rapport type
  const { data: monthlyListingData } = useGetMonthlyListing(year, period);
  const { data: allAppointments } = useGetAllAppointments();
  
  // Fetch previous month's listing for "Crédit du mois précédent" column
  const previousMonth = period === 1 ? 12 : period - 1;
  const previousYear = period === 1 ? year - 1 : year;
  const { data: previousMonthListingData } = useGetMonthlyListing(previousYear, previousMonth);

  const monthlyListings = monthlyListingData ? monthlyListingData[0] : [];
  const monthlyTotals = monthlyListingData ? monthlyListingData[1] : null;
  const previousMonthListings = previousMonthListingData ? previousMonthListingData[0] : undefined;

  // Calculate "Revenus (Faits et Payés)" using Monthly Listing formulas
  const revenusData = useMemo(() => {
    if (!rapportData || !monthlyListings || !allAppointments || rapportType !== 'mensuel') {
      return new Map<string, bigint>();
    }

    const revenusMap = new Map<string, bigint>();
    
    // For each client in the rapport, calculate their "Revenus (Faits et Payés)"
    // using the same formula as the Monthly Listing table
    rapportData.forEach(item => {
      const client = monthlyListings.find(c => c.referenceClient === item.referenceClient);
      if (client) {
        const revenus = calculateRevenusFaitsEtPayesFromListing(
          client,
          allAppointments,
          year,
          period,
          previousMonthListings
        );
        revenusMap.set(item.referenceClient, revenus);
      }
    });

    return revenusMap;
  }, [rapportData, monthlyListings, allAppointments, year, period, previousMonthListings, rapportType]);

  // Calculate totals for the "Total" row
  const totals = useMemo(() => {
    if (!rapportData || rapportData.length === 0) {
      return {
        totalNbRDV: BigInt(0),
        totalRevenus: BigInt(0),
        totalSommesDues: BigInt(0),
        totalCredits: BigInt(0),
      };
    }

    // For mensuel reports, use Monthly Listing calculations for the Total row
    if (rapportType === 'mensuel' && monthlyListings.length > 0 && allAppointments) {
      const totalRevenus = calculateTotalRevenusFaitsEtPayes(
        monthlyListings,
        allAppointments,
        year,
        period,
        previousMonthListings
      );

      return rapportData.reduce(
        (acc, item) => {
          const revenus = revenusData.get(item.referenceClient) || BigInt(0);
          return {
            totalNbRDV: acc.totalNbRDV + item.nbRendezVousFaits,
            totalRevenus: totalRevenus, // Use the Monthly Listing TOTAL
            totalSommesDues: acc.totalSommesDues + (item.totalSommesDues > revenus ? item.totalSommesDues - revenus : BigInt(0)),
            totalCredits: acc.totalCredits + item.totalCredits,
          };
        },
        {
          totalNbRDV: BigInt(0),
          totalRevenus: BigInt(0),
          totalSommesDues: BigInt(0),
          totalCredits: BigInt(0),
        }
      );
    }

    // For other report types, use backend data
    return rapportData.reduce(
      (acc, item) => ({
        totalNbRDV: acc.totalNbRDV + item.nbRendezVousFaits,
        totalRevenus: acc.totalRevenus + item.totalSommesRecues,
        totalSommesDues: acc.totalSommesDues + (item.totalSommesDues > item.totalSommesRecues ? item.totalSommesDues - item.totalSommesRecues : BigInt(0)),
        totalCredits: acc.totalCredits + item.totalCredits,
      }),
      {
        totalNbRDV: BigInt(0),
        totalRevenus: BigInt(0),
        totalSommesDues: BigInt(0),
        totalCredits: BigInt(0),
      }
    );
  }, [rapportData, rapportType, monthlyListings, allAppointments, year, period, previousMonthListings, revenusData]);

  const getPeriodLabel = () => {
    if (rapportType === 'annuel') {
      return `Année ${year}`;
    } else if (rapportType === 'hebdomadaire') {
      return `Semaine ${period}, ${year}`;
    } else {
      const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      return `${months[period - 1]} ${year}`;
    }
  };

  const handleDownloadPDF = () => {
    if (!rapportData || rapportData.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    // Create PDF content as HTML
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Rapport ${rapportType === 'hebdomadaire' ? 'Hebdomadaire' : rapportType === 'mensuel' ? 'Mensuel' : 'Annuel'} - ${year}</title>
        <style>
          body {
            font-family: Cambria, serif;
            font-size: 10pt;
            margin: 20px;
          }
          h1 {
            font-size: 16pt;
            margin-bottom: 10px;
            text-align: center;
          }
          h2 {
            font-size: 14pt;
            margin-top: 30px;
            margin-bottom: 15px;
          }
          .period-info {
            font-size: 12pt;
            margin-bottom: 20px;
            text-align: center;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #333;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .number {
            text-align: right;
          }
          .red-text {
            color: red;
          }
          .total-row {
            font-weight: bold;
            background-color: #e8e8e8;
          }
          .positive {
            color: green;
            font-weight: bold;
          }
          .negative {
            color: red;
            font-weight: bold;
          }
          .monthly-listing {
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <h1>Rapport ${rapportType === 'hebdomadaire' ? 'Hebdomadaire' : rapportType === 'mensuel' ? 'Mensuel' : 'Annuel'}</h1>
        <div class="period-info">${getPeriodLabel()}</div>
        <table>
          <thead>
            <tr>
              <th>Réf</th>
              <th>Nom</th>
              <th class="number">Nbr RDV</th>
              <th class="number">Revenus (Faits et Payés)</th>
              <th class="number">Sommes Dues</th>
              <th class="number">Crédits</th>
            </tr>
          </thead>
          <tbody>
    `;

    // Add data rows
    rapportData.forEach(item => {
      // For mensuel reports, use calculated "Revenus (Faits et Payés)"
      const revenus = rapportType === 'mensuel' 
        ? (revenusData.get(item.referenceClient) || BigInt(0))
        : item.totalSommesRecues;
      
      const sommesDues = item.totalSommesDues > revenus 
        ? item.totalSommesDues - revenus 
        : BigInt(0);

      htmlContent += `
            <tr>
              <td>${item.referenceClient}</td>
              <td>${item.nomClient}</td>
              <td class="number">${Number(item.nbRendezVousFaits)}</td>
              <td class="number">${Number(revenus).toLocaleString('fr-FR')}</td>
              <td class="number ${sommesDues > 0 ? 'red-text' : ''}">${Number(sommesDues).toLocaleString('fr-FR')}</td>
              <td class="number ${item.totalCredits > 0 ? 'positive' : ''}">${Number(item.totalCredits).toLocaleString('fr-FR')}</td>
            </tr>
      `;
    });

    // Add total row
    htmlContent += `
            <tr class="total-row">
              <td colspan="2">TOTAL</td>
              <td class="number">${Number(totals.totalNbRDV)}</td>
              <td class="number">${Number(totals.totalRevenus).toLocaleString('fr-FR')}</td>
              <td class="number ${totals.totalSommesDues > 0 ? 'red-text' : ''}">${Number(totals.totalSommesDues).toLocaleString('fr-FR')}</td>
              <td class="number ${totals.totalCredits > 0 ? 'positive' : ''}">${Number(totals.totalCredits).toLocaleString('fr-FR')}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Create a Blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${rapportType}-${year}-${period}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatNumber = (amount: bigint | number) => {
    return Number(amount).toLocaleString('fr-FR');
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Rapport PDF</h1>
        <p className="text-muted-foreground">
          Générez et exportez des rapports détaillés
        </p>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration du rapport</CardTitle>
          <CardDescription>
            Sélectionnez le type de rapport et la période
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type de rapport</label>
              <Select
                value={rapportType}
                onValueChange={(value) => setRapportType(value as 'hebdomadaire' | 'mensuel' | 'annuel')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                  <SelectItem value="mensuel">Mensuel</SelectItem>
                  <SelectItem value="annuel">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Année</label>
              <Select
                value={year.toString()}
                onValueChange={(value) => setYear(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {rapportType === 'hebdomadaire' ? 'Semaine' : rapportType === 'mensuel' ? 'Mois' : 'Période'}
              </label>
              <Select
                value={period.toString()}
                onValueChange={(value) => setPeriod(parseInt(value))}
                disabled={rapportType === 'annuel'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rapportType === 'hebdomadaire'
                    ? Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                        <SelectItem key={week} value={week.toString()}>
                          Semaine {week}
                        </SelectItem>
                      ))
                    : Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {
                            [
                              'Janvier',
                              'Février',
                              'Mars',
                              'Avril',
                              'Mai',
                              'Juin',
                              'Juillet',
                              'Août',
                              'Septembre',
                              'Octobre',
                              'Novembre',
                              'Décembre',
                            ][month - 1]
                          }
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Data Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Données du rapport</CardTitle>
              <CardDescription>{getPeriodLabel()}</CardDescription>
            </div>
            <Button
              onClick={handleDownloadPDF}
              disabled={isLoading || !rapportData || rapportData.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exporter HTML
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !rapportData || rapportData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucune donnée disponible pour cette période
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead className="text-right">Nbr RDV</TableHead>
                    <TableHead className="text-right">Revenus (Faits et Payés)</TableHead>
                    <TableHead className="text-right">Sommes Dues</TableHead>
                    <TableHead className="text-right">Crédits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Total Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={2}>TOTAL</TableCell>
                    <TableCell className="text-right">{Number(totals.totalNbRDV)}</TableCell>
                    <TableCell className="text-right">{formatNumber(totals.totalRevenus)}</TableCell>
                    <TableCell className="text-right">
                      <span className={totals.totalSommesDues > 0 ? 'text-red-600' : ''}>
                        {formatNumber(totals.totalSommesDues)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={totals.totalCredits > 0 ? 'text-green-600 font-semibold' : ''}>
                        {formatNumber(totals.totalCredits)}
                      </span>
                    </TableCell>
                  </TableRow>

                  {/* Data Rows */}
                  {rapportData.map((item) => {
                    // For mensuel reports, use calculated "Revenus (Faits et Payés)"
                    const revenus = rapportType === 'mensuel' 
                      ? (revenusData.get(item.referenceClient) || BigInt(0))
                      : item.totalSommesRecues;
                    
                    const sommesDues = item.totalSommesDues > revenus 
                      ? item.totalSommesDues - revenus 
                      : BigInt(0);

                    return (
                      <TableRow key={item.referenceClient}>
                        <TableCell className="font-medium">{item.referenceClient}</TableCell>
                        <TableCell>{item.nomClient}</TableCell>
                        <TableCell className="text-right">{Number(item.nbRendezVousFaits)}</TableCell>
                        <TableCell className="text-right">{formatNumber(revenus)}</TableCell>
                        <TableCell className="text-right">
                          <span className={sommesDues > 0 ? 'text-red-600' : ''}>
                            {formatNumber(sommesDues)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={item.totalCredits > 0 ? 'text-green-600 font-semibold' : ''}>
                            {formatNumber(item.totalCredits)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Listing Table - Only show for mensuel reports */}
      {rapportType === 'mensuel' && monthlyListings.length > 0 && allAppointments && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Listing Mensuel Intégré</CardTitle>
                <CardDescription>
                  Tableau détaillé avec calculs Excel pour {getPeriodLabel()}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <MonthlyListingTable
              listings={monthlyListings}
              totals={monthlyTotals}
              allAppointments={allAppointments}
              year={year}
              month={period}
              previousMonthListings={previousMonthListings}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
