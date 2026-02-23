import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RendezVous } from '../backend';
import { calculateMonthlyListingRow, calculateTotalRevenusFaitsEtPayes } from '../utils/monthlyListing';

interface MonthlySummarySectionProps {
  year: number;
  allAppointments: RendezVous[];
}

export default function MonthlySummarySection({ year, allAppointments }: MonthlySummarySectionProps) {
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // Calculate "Revenus (Faits et Payés)" for each month using the same logic as Monthly Listing
  const monthlyRevenues = useMemo(() => {
    const revenues: { month: string; revenue: bigint }[] = [];

    for (let month = 1; month <= 12; month++) {
      // Get unique clients for this month
      const monthStart = BigInt(new Date(year, month - 1, 1).getTime()) * BigInt(1_000_000);
      const monthEnd = BigInt(new Date(year, month, 0, 23, 59, 59, 999).getTime()) * BigInt(1_000_000);
      
      const clientsInMonth = new Map<string, string>();
      allAppointments.forEach(apt => {
        if (apt.dateHeure >= monthStart && apt.dateHeure <= monthEnd) {
          clientsInMonth.set(apt.referenceClient, apt.nomClient);
        }
      });

      // Calculate monthly listing rows for all clients
      const rows = Array.from(clientsInMonth.entries()).map(([referenceClient, nomClient]) => {
        return calculateMonthlyListingRow(
          referenceClient,
          nomClient,
          allAppointments,
          year,
          month
        );
      });

      // Sum up the "Revenus (Faits et Payés)" column
      const monthRevenue = calculateTotalRevenusFaitsEtPayes(rows);

      revenues.push({
        month: monthNames[month - 1],
        revenue: monthRevenue,
      });
    }

    return revenues;
  }, [year, allAppointments, monthNames]);

  const totalRevenue = useMemo(() => {
    return monthlyRevenues.reduce((sum, item) => sum + item.revenue, BigInt(0));
  }, [monthlyRevenues]);

  const formatNumber = (amount: bigint) => {
    return Number(amount).toLocaleString('fr-FR');
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="frame-title">Résumé Mensuels (Année en Cours)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="table-header">Mois</TableHead>
                <TableHead className="text-right table-header">Revenus (Faits et Payés)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyRevenues.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="table-data">{item.month}</TableCell>
                  <TableCell className="text-right table-data">{formatNumber(item.revenue)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell className="table-header">TOTAL</TableCell>
                <TableCell className="text-right sum-total">{formatNumber(totalRevenue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
