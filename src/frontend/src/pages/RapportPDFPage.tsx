import { useState, useMemo } from 'react';
import { useGetRapportPDF, useGetMonthlyListing, useGetAllAppointments } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText } from 'lucide-react';
import { RapportType } from '../backend';
import MonthlyListingTable from '../components/MonthlyListingTable';
import { generateMonthlyListingHTML, calculateClientRevenusFaitsEtPayes, calculateTotalRevenusFaitsEtPayes } from '../utils/monthlyListing';

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
        const revenus = calculateClientRevenusFaitsEtPayes(
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
            <tr class="total-row">
              <td colspan="2">Total</td>
              <td class="number">${totals.totalNbRDV.toString()}</td>
              <td class="number">${totals.totalRevenus.toString()}</td>
              <td class="number red-text">${totals.totalSommesDues.toString()}</td>
              <td class="number">${totals.totalCredits.toString()}</td>
            </tr>
            ${rapportData.map(item => {
              // Use Monthly Listing calculation for mensuel reports
              const revenus = rapportType === 'mensuel' && revenusData.has(item.referenceClient)
                ? revenusData.get(item.referenceClient)!
                : item.totalSommesRecues;
              
              const sommesDues = item.totalSommesDues > revenus 
                ? Number(item.totalSommesDues - revenus) 
                : 0;
              return `
              <tr>
                <td>${item.referenceClient}</td>
                <td>${item.nomClient}</td>
                <td class="number">${item.nbRendezVousFaits.toString()}</td>
                <td class="number">${revenus.toString()}</td>
                <td class="number red-text">${sommesDues}</td>
                <td class="number">${item.totalCredits.toString()}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
    `;

    // Add Monthly Listing table for mensuel rapport type
    if (rapportType === 'mensuel' && monthlyListings.length > 0 && allAppointments) {
      const monthlyListingHTML = generateMonthlyListingHTML(
        monthlyListings,
        allAppointments,
        year,
        period,
        previousMonthListings
      );
      htmlContent += `
        <h2>Listing Mensuel</h2>
        ${monthlyListingHTML}
      `;
    }

    htmlContent += `
      </body>
      </html>
    `;

    // Create a blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${rapportType}_${year}_${period}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const years = [2024, 2025, 2026, 2027, 2028];
  const months = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Cambria, serif' }}>Rapport PDF</h1>
        <p className="text-muted-foreground" style={{ fontFamily: 'Cambria, serif' }}>
          Générez et téléchargez des rapports de synthèse
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle style={{ fontFamily: 'Cambria, serif' }}>Configuration du rapport</CardTitle>
          <CardDescription style={{ fontFamily: 'Cambria, serif' }}>
            Sélectionnez le type de rapport, l'année et la période
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ fontFamily: 'Cambria, serif' }}>
                Type de rapport
              </label>
              <Select value={rapportType} onValueChange={(value: 'hebdomadaire' | 'mensuel' | 'annuel') => setRapportType(value)}>
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

            <div>
              <label className="text-sm font-medium mb-2 block" style={{ fontFamily: 'Cambria, serif' }}>
                Année
              </label>
              <Select value={year.toString()} onValueChange={(value) => setYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rapportType !== 'annuel' && (
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ fontFamily: 'Cambria, serif' }}>
                  {rapportType === 'hebdomadaire' ? 'Semaine' : 'Mois'}
                </label>
                <Select value={period.toString()} onValueChange={(value) => setPeriod(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rapportType === 'mensuel' ? (
                      months.map((m) => (
                        <SelectItem key={m.value} value={m.value.toString()}>
                          {m.label}
                        </SelectItem>
                      ))
                    ) : (
                      Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                        <SelectItem key={week} value={week.toString()}>
                          Semaine {week}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="mt-6">
            <Button onClick={handleDownloadPDF} disabled={isLoading || !rapportData || rapportData.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Télécharger le rapport
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontFamily: 'Cambria, serif' }}>Aperçu du rapport</CardTitle>
          <CardDescription style={{ fontFamily: 'Cambria, serif' }}>
            Prévisualisation des données avant téléchargement
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : rapportData && rapportData.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table style={{ fontFamily: 'Cambria, serif', fontSize: '10pt' }}>
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
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">{totals.totalNbRDV.toString()}</TableCell>
                      <TableCell className="text-right">{totals.totalRevenus.toString()}</TableCell>
                      <TableCell className="text-right text-red-600">{totals.totalSommesDues.toString()}</TableCell>
                      <TableCell className="text-right">{totals.totalCredits.toString()}</TableCell>
                    </TableRow>
                    {rapportData.map((item, index) => {
                      // Use Monthly Listing calculation for mensuel reports
                      const revenus = rapportType === 'mensuel' && revenusData.has(item.referenceClient)
                        ? revenusData.get(item.referenceClient)!
                        : item.totalSommesRecues;
                      
                      const sommesDues = item.totalSommesDues > revenus 
                        ? Number(item.totalSommesDues - revenus) 
                        : 0;
                      return (
                        <TableRow key={index}>
                          <TableCell>{item.referenceClient}</TableCell>
                          <TableCell>{item.nomClient}</TableCell>
                          <TableCell className="text-right">{item.nbRendezVousFaits.toString()}</TableCell>
                          <TableCell className="text-right">{revenus.toString()}</TableCell>
                          <TableCell className="text-right text-red-600">{sommesDues}</TableCell>
                          <TableCell className="text-right">{item.totalCredits.toString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Add Monthly Listing table for mensuel rapport type */}
              {rapportType === 'mensuel' && monthlyListings.length > 0 && allAppointments && (
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Cambria, serif' }}>
                    Listing Mensuel
                  </h3>
                  <MonthlyListingTable
                    listings={monthlyListings}
                    totals={monthlyTotals}
                    allAppointments={allAppointments}
                    year={year}
                    month={period}
                    previousMonthListings={previousMonthListings}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune donnée disponible pour cette période</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
