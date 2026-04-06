import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemo, useState } from "react";
import type {
  DomaineListingMensuel,
  RendezVous,
  TotauxListingMensuel,
} from "../backend";
import { useTranslation } from "../hooks/useTranslation";
import {
  type MonthlyListingRow,
  calculateMonthlyListingRow,
  calculateTotalCreditNegatif,
  calculateTotalCreditPositif,
  calculateTotalRevenusFaitsEtPayes,
  calculateTotalRevenusPlusAvances,
} from "../utils/monthlyListing";

interface MonthlyListingTableProps {
  listings: DomaineListingMensuel[];
  totals: TotauxListingMensuel | null;
  allAppointments: RendezVous[];
  year: number;
  month: number;
}

export default function MonthlyListingTable({
  listings,
  totals: _totals,
  allAppointments,
  year,
  month,
}: MonthlyListingTableProps) {
  const { t } = useTranslation();
  // State for manual January credit overrides (per client)
  const [januaryCredits, setJanuaryCredits] = useState<Record<string, bigint>>(
    {},
  );

  const formatNumber = (amount: bigint | number) => {
    return Number(amount).toLocaleString("fr-FR");
  };

  const formatBalance = (balance: bigint, showSign = true) => {
    const numBalance = Number(balance);
    const isPositive = numBalance >= 0;
    const className = isPositive
      ? "text-green-600 font-semibold"
      : "text-red-600 font-semibold";
    const sign = showSign && isPositive ? "+" : "";
    return (
      <span className={className}>
        {sign}
        {numBalance.toLocaleString("fr-FR")}
      </span>
    );
  };

  // Calculate all rows in a single memoized pass
  const calculatedRows = useMemo<MonthlyListingRow[]>(() => {
    return listings.map((client) => {
      const manualCredit = januaryCredits[client.referenceClient];
      return calculateMonthlyListingRow(
        client.referenceClient,
        client.nomClient,
        allAppointments,
        year,
        month,
        manualCredit,
      );
    });
  }, [listings, allAppointments, year, month, januaryCredits]);

  // Calculate totals from calculated rows
  const totalNbRdv = useMemo(() => {
    return calculatedRows.reduce((sum, row) => sum + row.nbRendezVousFaits, 0);
  }, [calculatedRows]);

  const totalRdvFaits = useMemo(() => {
    return calculatedRows.reduce((sum, row) => sum + row.rdvFaits, BigInt(0));
  }, [calculatedRows]);

  const totalRevenusFaitsEtPayes = useMemo(() => {
    return calculateTotalRevenusFaitsEtPayes(calculatedRows);
  }, [calculatedRows]);

  const totalRevenusPlusAvances = useMemo(() => {
    return calculateTotalRevenusPlusAvances(calculatedRows);
  }, [calculatedRows]);

  const totalCreditPositif = useMemo(() => {
    return calculateTotalCreditPositif(calculatedRows);
  }, [calculatedRows]);

  const totalCreditNegatif = useMemo(() => {
    return calculateTotalCreditNegatif(calculatedRows);
  }, [calculatedRows]);

  const handleJanuaryCreditChange = (
    referenceClient: string,
    value: string,
  ) => {
    const numValue = value.replace(/[^0-9-]/g, "");
    if (numValue === "" || numValue === "-") {
      setJanuaryCredits((prev) => {
        const next = { ...prev };
        delete next[referenceClient];
        return next;
      });
    } else {
      const bigintValue = BigInt(numValue);
      setJanuaryCredits((prev) => ({
        ...prev,
        [referenceClient]: bigintValue,
      }));
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="table-header">{t("client.ref")}</TableHead>
            <TableHead className="table-header">
              {t("dashboard.nomCol")}
            </TableHead>
            <TableHead className="text-right table-header">Nbr</TableHead>
            <TableHead className="text-right table-header">
              {t("dashboard.creditMoisPrecedent")}
            </TableHead>
            <TableHead className="text-right table-header">
              {t("dashboard.rdvFaitsPaysImpays")}
            </TableHead>
            <TableHead className="text-right table-header">
              {t("dashboard.revenusFaitsPayesFull")}
            </TableHead>
            <TableHead className="text-right table-header">
              {t("dashboard.revenusPlusAvances")}
            </TableHead>
            <TableHead className="text-right table-header">
              {t("dashboard.creditPositif")}
            </TableHead>
            <TableHead className="text-right table-header">
              {t("dashboard.creditNegatif")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Total Row */}
          <TableRow className="bg-muted/50">
            <TableCell colSpan={2} className="table-header">
              {t("dashboard.total")}
            </TableCell>
            <TableCell className="text-right sum-total">{totalNbRdv}</TableCell>
            <TableCell className="text-right sum-total">-</TableCell>
            <TableCell className="text-right sum-total">
              {formatNumber(totalRdvFaits)}
            </TableCell>
            <TableCell className="text-right sum-total">
              {formatNumber(totalRevenusFaitsEtPayes)}
            </TableCell>
            <TableCell className="text-right sum-total">
              {formatNumber(totalRevenusPlusAvances)}
            </TableCell>
            <TableCell className="text-right sum-total">
              {formatBalance(totalCreditPositif)}
            </TableCell>
            <TableCell className="text-right sum-total">
              {formatBalance(totalCreditNegatif)}
            </TableCell>
          </TableRow>

          {/* Client Rows */}
          {calculatedRows.map((row) => (
            <TableRow key={row.referenceClient}>
              <TableCell className="table-data">
                {row.referenceClient}
              </TableCell>
              <TableCell className="table-data">{row.nomClient}</TableCell>
              <TableCell className="text-right table-data">
                {row.nbRendezVousFaits}
              </TableCell>
              <TableCell className="text-right table-data">
                {month === 1 ? (
                  <Input
                    type="text"
                    value={
                      januaryCredits[row.referenceClient]?.toString() ?? "0"
                    }
                    onChange={(e) =>
                      handleJanuaryCreditChange(
                        row.referenceClient,
                        e.target.value,
                      )
                    }
                    className="w-24 h-6 table-data text-right"
                  />
                ) : (
                  formatBalance(row.creditDuMoisPrecedent)
                )}
              </TableCell>
              <TableCell className="text-right table-data">
                {formatNumber(row.rdvFaits)}
              </TableCell>
              <TableCell className="text-right table-data">
                {formatNumber(row.revenusFaitsEtPayes)}
              </TableCell>
              <TableCell className="text-right table-data">
                {formatNumber(row.revenusPlusAvances)}
              </TableCell>
              <TableCell className="text-right table-data">
                {row.creditPositif > BigInt(0)
                  ? formatBalance(row.creditPositif)
                  : "0"}
              </TableCell>
              <TableCell className="text-right table-data">
                {row.creditNegatif < BigInt(0)
                  ? formatBalance(row.creditNegatif)
                  : "0"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
