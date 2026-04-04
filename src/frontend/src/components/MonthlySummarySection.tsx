import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemo } from "react";
import type { RendezVous } from "../backend";
import {
  calculateMonthlyListingRow,
  calculateRdvFaits,
  calculateRevenusPlusAvances,
  calculateTotalRevenusFaitsEtPayes,
} from "../utils/monthlyListing";

interface MonthlySummarySectionProps {
  year: number;
  allAppointments: RendezVous[];
}

export default function MonthlySummarySection({
  year,
  allAppointments,
}: MonthlySummarySectionProps) {
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

  const monthlyRevenues = useMemo(() => {
    const revenues: {
      month: string;
      revenue: bigint;
      rdvFaits: bigint;
      sommesRecues: bigint;
    }[] = [];

    for (let month = 1; month <= 12; month++) {
      const monthStart =
        BigInt(new Date(year, month - 1, 1).getTime()) * BigInt(1_000_000);
      const monthEnd =
        BigInt(new Date(year, month, 0, 23, 59, 59, 999).getTime()) *
        BigInt(1_000_000);

      const clientsInMonth = new Map<string, string>();
      for (const apt of allAppointments) {
        if (apt.dateHeure >= monthStart && apt.dateHeure <= monthEnd) {
          clientsInMonth.set(apt.referenceClient, apt.nomClient);
        }
      }

      const rows = Array.from(clientsInMonth.entries()).map(
        ([referenceClient, nomClient]) => {
          return calculateMonthlyListingRow(
            referenceClient,
            nomClient,
            allAppointments,
            year,
            month,
          );
        },
      );

      const monthRevenue = calculateTotalRevenusFaitsEtPayes(rows);

      // RDV Faits (payé et impayés) = sum of rdvFaits across all clients for this month
      const monthRdvFaits = Array.from(clientsInMonth.keys()).reduce(
        (sum, ref) =>
          sum + calculateRdvFaits(ref, allAppointments, year, month),
        BigInt(0),
      );

      // Sommes reçus = sum of all montantPaye for this month
      const monthSommesRecues = Array.from(clientsInMonth.keys()).reduce(
        (sum, ref) =>
          sum + calculateRevenusPlusAvances(ref, allAppointments, year, month),
        BigInt(0),
      );

      revenues.push({
        month: monthNames[month - 1],
        revenue: monthRevenue,
        rdvFaits: monthRdvFaits,
        sommesRecues: monthSommesRecues,
      });
    }

    return revenues;
  }, [year, allAppointments]);

  const totalRevenue = useMemo(() => {
    return monthlyRevenues.reduce((sum, item) => sum + item.revenue, BigInt(0));
  }, [monthlyRevenues]);

  const totalRdvFaits = useMemo(() => {
    return monthlyRevenues.reduce(
      (sum, item) => sum + item.rdvFaits,
      BigInt(0),
    );
  }, [monthlyRevenues]);

  const totalSommesRecues = useMemo(() => {
    return monthlyRevenues.reduce(
      (sum, item) => sum + item.sommesRecues,
      BigInt(0),
    );
  }, [monthlyRevenues]);

  const formatNumber = (amount: bigint) => {
    return Number(amount).toLocaleString("fr-FR");
  };

  return (
    <Card className="mb-0">
      <CardHeader>
        <CardTitle className="frame-title">
          Résumé Mensuels (Année en Cours)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="table-header">Mois</TableHead>
                <TableHead className="text-right table-header">
                  RDV Faits (payé et impayés)
                </TableHead>
                <TableHead className="text-right table-header">
                  Sommes reçus
                </TableHead>
                <TableHead className="text-right table-header">
                  Revenus (Faits et Payés)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Total row moved to top, above January */}
              <TableRow className="bg-muted/50">
                <TableCell className="table-header py-1">TOTAL</TableCell>
                <TableCell className="text-right sum-total py-1">
                  {formatNumber(totalRdvFaits)}
                </TableCell>
                <TableCell className="text-right sum-total py-1">
                  {formatNumber(totalSommesRecues)}
                </TableCell>
                <TableCell className="text-right sum-total py-1">
                  {formatNumber(totalRevenue)}
                </TableCell>
              </TableRow>
              {monthlyRevenues.map((item, index) => (
                <TableRow
                  key={item.month}
                  className={index % 2 === 1 ? "bg-muted/50" : ""}
                >
                  <TableCell className="table-data py-1">
                    {item.month}
                  </TableCell>
                  <TableCell className="text-right table-data py-1">
                    {formatNumber(item.rdvFaits)}
                  </TableCell>
                  <TableCell className="text-right table-data py-1">
                    {formatNumber(item.sommesRecues)}
                  </TableCell>
                  <TableCell className="text-right table-data py-1">
                    {formatNumber(item.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
