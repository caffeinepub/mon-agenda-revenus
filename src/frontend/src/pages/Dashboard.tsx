import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";
import ComptaMoisCalendarTable from "../components/ComptaMoisCalendarTable";
import MonthlyListingTable from "../components/MonthlyListingTable";
import MonthlySummarySection from "../components/MonthlySummarySection";
import {
  useGetAllAppointments,
  useGetMonthlyListing,
} from "../hooks/useQueries";
import { bigintAbs } from "../utils/bigintMath";
import {
  type MonthlyListingRow,
  calculateMonthlyListingRow,
  calculateTotalCreditNegatif,
  calculateTotalRevenusFaitsEtPayes,
} from "../utils/monthlyListing";

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function formatNum(amount: bigint): string {
  return Number(amount).toLocaleString("fr-FR");
}

export default function Dashboard() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() + 1,
  );

  const { data: allAppointments = [] } = useGetAllAppointments();
  const { data: monthlyListingData } = useGetMonthlyListing(
    selectedYear,
    selectedMonth,
  );

  const listings = monthlyListingData?.[0] ?? [];
  const totals = monthlyListingData?.[1] ?? null;

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  // Monthly revenues for the entire year (used by MonthlySummarySection and annual stats)
  const monthlyRevenues = useMemo(() => {
    const revenues: bigint[] = [];
    for (let month = 1; month <= 12; month++) {
      const monthStart =
        BigInt(new Date(selectedYear, month - 1, 1).getTime()) *
        BigInt(1_000_000);
      const monthEnd =
        BigInt(new Date(selectedYear, month, 0, 23, 59, 59, 999).getTime()) *
        BigInt(1_000_000);

      const clientsInMonth = new Map<string, string>();
      for (const apt of allAppointments) {
        if (apt.dateHeure >= monthStart && apt.dateHeure <= monthEnd) {
          clientsInMonth.set(apt.referenceClient, apt.nomClient);
        }
      }

      const rows = Array.from(clientsInMonth.entries()).map(
        ([referenceClient, nomClient]) =>
          calculateMonthlyListingRow(
            referenceClient,
            nomClient,
            allAppointments,
            selectedYear,
            month,
          ),
      );

      revenues.push(calculateTotalRevenusFaitsEtPayes(rows));
    }
    return revenues;
  }, [selectedYear, allAppointments]);

  // Rows for the selected month (for financial cards E/F/G)
  const calculatedRows = useMemo<MonthlyListingRow[]>(() => {
    return listings.map((client) =>
      calculateMonthlyListingRow(
        client.referenceClient,
        client.nomClient,
        allAppointments,
        selectedYear,
        selectedMonth,
      ),
    );
  }, [listings, allAppointments, selectedYear, selectedMonth]);

  // Cards E, F, G — Mois courant
  const financialOverviewData = useMemo(() => {
    const selectedMonthIndex = selectedMonth - 1;
    const totalPaid = monthlyRevenues[selectedMonthIndex] ?? BigInt(0);
    const creditNegatifTotal = calculateTotalCreditNegatif(calculatedRows);
    const totalRdvFaitsMoisCourant = calculatedRows.reduce(
      (sum, row) => sum + row.rdvFaits,
      BigInt(0),
    );
    return {
      totalDue: bigintAbs(creditNegatifTotal),
      totalPaid,
      totalRdvFaitsMoisCourant,
    };
  }, [selectedMonth, monthlyRevenues, calculatedRows]);

  // Cards A, B, C — Synthèse de l'année
  const annualStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    let totalRevenue = BigInt(0);
    for (const r of monthlyRevenues) {
      totalRevenue += r;
    }

    const completedMonthsCount =
      selectedYear < currentYear
        ? 12
        : selectedYear === currentYear
          ? currentMonth - 1
          : 0;

    let totalCompletedRevenue = BigInt(0);
    for (let i = 0; i < completedMonthsCount; i++) {
      totalCompletedRevenue += monthlyRevenues[i];
    }

    const averageRevenue =
      completedMonthsCount > 0
        ? totalCompletedRevenue / BigInt(completedMonthsCount)
        : BigInt(0);

    // Calcul du nombre moyen de RDV par mois (mois terminés uniquement)
    // On compte les RDV mois par mois puis on fait la moyenne
    let totalRdvCompleted = 0;
    for (let m = 1; m <= completedMonthsCount; m++) {
      const monthStart =
        BigInt(new Date(selectedYear, m - 1, 1).getTime()) * BigInt(1_000_000);
      const monthEnd =
        BigInt(new Date(selectedYear, m, 0, 23, 59, 59, 999).getTime()) *
        BigInt(1_000_000);
      const rdvInMonth = allAppointments.filter(
        (apt) =>
          apt.dateHeure >= monthStart && apt.dateHeure <= monthEnd && apt.fait,
      ).length;
      totalRdvCompleted += rdvInMonth;
    }

    const averageRdvPerMonth =
      completedMonthsCount > 0
        ? Math.round(totalRdvCompleted / completedMonthsCount)
        : 0;

    return {
      totalRevenue,
      averageRevenue,
      completedMonthsCount,
      averageRdvPerMonth,
    };
  }, [monthlyRevenues, selectedYear, allAppointments]);

  const currentMonthLabel = MONTH_NAMES[selectedMonth - 1];

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <h1 className="frame-title text-3xl mb-6">Tableau de bord</h1>

        {/* ── TOP SECTION: 3-column grid ── */}
        <div className="grid grid-cols-[1fr_2fr_1fr] gap-4 mb-6 items-start">
          {/* ── LEFT COLUMN: A / B / C — Synthèse de l'année ── */}
          <div className="flex flex-col gap-4">
            {/* Section label — increased 3 font-size steps, bold */}
            <p
              className="text-center font-bold text-xl"
              style={{ fontFamily: "Verdana, sans-serif" }}
            >
              Synthèse de l'année
            </p>

            {/* Card A — Revenu moyen */}
            <Card className="flex-1">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="frame-title">
                  Revenu moyen {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="table-data text-muted-foreground">
                  Basé sur {annualStats.completedMonthsCount} mois terminé
                  {annualStats.completedMonthsCount > 1 ? "s" : ""}
                </p>
                <p className="sum-total text-2xl font-bold mt-1">
                  {formatNum(annualStats.averageRevenue)}
                </p>
              </CardContent>
            </Card>

            {/* Card B — Nombre de RDV moyen par mois */}
            <Card className="flex-1">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="frame-title">
                  Nombre de RDV moyen par mois {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="table-data text-muted-foreground">
                  Basé sur {annualStats.completedMonthsCount} mois terminé
                  {annualStats.completedMonthsCount > 1 ? "s" : ""}
                </p>
                <p className="sum-total text-2xl font-bold mt-1">
                  {annualStats.averageRdvPerMonth}
                </p>
              </CardContent>
            </Card>

            {/* Card C — Statistiques annuelles */}
            <Card className="flex-1">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="frame-title">
                  Statistiques annuelles {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="table-data text-muted-foreground">Total reçu</p>
                <p className="sum-total text-2xl font-bold mt-1">
                  {formatNum(annualStats.totalRevenue)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── CENTER COLUMN: D — Résumé Mensuels ── */}
          <div className="flex flex-col gap-4">
            {/* Section label — increased 3 font-size steps, bold */}
            <p
              className="text-center font-bold text-xl"
              style={{ fontFamily: "Verdana, sans-serif" }}
            >
              ANNEE : {selectedYear}
            </p>
            <MonthlySummarySection
              year={selectedYear}
              allAppointments={allAppointments}
            />
          </div>

          {/* ── RIGHT COLUMN: E / F / G — Mois courant ── */}
          <div className="flex flex-col gap-4">
            {/* Section label — increased 3 font-size steps, bold */}
            <p
              className="text-center font-bold text-xl"
              style={{ fontFamily: "Verdana, sans-serif" }}
            >
              Mois de : {currentMonthLabel}
            </p>

            {/* Card E — Dus (RDV Faits ; Mois Courant) */}
            <Card className="flex-1">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="frame-title">
                  Dus (RDV Faits ; Mois Courant)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="sum-total text-2xl font-bold text-orange-600 mt-1">
                  {formatNum(financialOverviewData.totalDue)}
                </p>
                <p className="table-data text-muted-foreground mt-1">
                  Montants restant à percevoir
                </p>
              </CardContent>
            </Card>

            {/* Card F — RDV faits (Payés et Impayés ; Mois Courant) */}
            <Card className="flex-1">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="frame-title">
                  RDV faits (Payés et Impayés ; Mois Courant)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="sum-total text-2xl font-bold text-blue-600 mt-1">
                  {formatNum(financialOverviewData.totalRdvFaitsMoisCourant)}
                </p>
                <p className="table-data text-muted-foreground mt-1">
                  Total des montants dus pour les rendez-vous effectués
                </p>
              </CardContent>
            </Card>

            {/* Card G — Revenus du Mois en Cours (Faits et Payés) */}
            <Card className="flex-1">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="frame-title">
                  Revenus du Mois en Cours (Faits et Payés)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="sum-total text-2xl font-bold text-green-600 mt-1">
                  {formatNum(financialOverviewData.totalPaid)}
                </p>
                <p className="table-data text-muted-foreground mt-1">
                  Montants perçus pour les rendez-vous effectués
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── FRAME H — Listing Mensuel (full width) ── */}
        <Card className="mb-6 w-full">
          <CardHeader>
            <CardTitle className="frame-title">Listing Mensuel</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyListingTable
              listings={listings}
              totals={totals}
              allAppointments={allAppointments}
              year={selectedYear}
              month={selectedMonth}
            />
          </CardContent>
        </Card>

        {/* ── FRAME I — Calendrier mensuel (untouched) ── */}
        <Card>
          <CardHeader>
            <CardTitle className="frame-title">Calendrier mensuel</CardTitle>
          </CardHeader>
          <CardContent>
            <ComptaMoisCalendarTable
              year={selectedYear}
              month={selectedMonth}
              onMonthChange={handleMonthChange}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
