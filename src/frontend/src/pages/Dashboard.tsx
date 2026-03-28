import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";
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

  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  };

  const { data: allAppointments = [] } = useGetAllAppointments();
  const { data: monthlyListingData } = useGetMonthlyListing(
    selectedYear,
    selectedMonth,
  );

  const listings = monthlyListingData?.[0] ?? [];
  const totals = monthlyListingData?.[1] ?? null;

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
      <main className="container mx-auto px-2 py-4 md:px-4 md:py-8">
        <h1 className="frame-title text-2xl md:text-3xl mb-4 md:mb-6">
          Tableau de bord
        </h1>

        {/* ── TOP SECTION: 3-column grid — 1 column on mobile ── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 mb-6 items-start dashboard-grid">
          {/* ── LEFT COLUMN: A / B / C merged — Synthèse de l'année ── */}
          <div className="flex flex-col gap-4">
            <p
              className="text-center font-bold text-xl"
              style={{ fontFamily: "Verdana, sans-serif" }}
            >
              Synthèse de l'année
            </p>

            <Card>
              <CardContent className="px-4 py-2">
                {/* Row A — Revenu moyen */}
                <div className="py-1">
                  <p
                    className="frame-title font-bold"
                    style={{
                      fontFamily: "Verdana,sans-serif",
                      fontSize: "11px",
                    }}
                  >
                    Revenu moyen {selectedYear}
                  </p>
                  <p
                    className="table-data text-muted-foreground"
                    style={{ fontSize: "9px" }}
                  >
                    Basé sur {annualStats.completedMonthsCount} mois terminé
                    {annualStats.completedMonthsCount > 1 ? "s" : ""}
                  </p>
                  <p
                    className="sum-total font-bold"
                    style={{
                      fontFamily: "Verdana,sans-serif",
                      fontSize: "14px",
                    }}
                  >
                    {formatNum(annualStats.averageRevenue)}
                  </p>
                </div>

                {/* Row B — Nombre de RDV moyen par mois */}
                <div className="border-t py-1">
                  <p
                    className="frame-title font-bold"
                    style={{
                      fontFamily: "Verdana,sans-serif",
                      fontSize: "11px",
                    }}
                  >
                    Nombre de RDV moyen par mois {selectedYear}
                  </p>
                  <p
                    className="table-data text-muted-foreground"
                    style={{ fontSize: "9px" }}
                  >
                    Basé sur {annualStats.completedMonthsCount} mois terminé
                    {annualStats.completedMonthsCount > 1 ? "s" : ""}
                  </p>
                  <p
                    className="sum-total font-bold"
                    style={{
                      fontFamily: "Verdana,sans-serif",
                      fontSize: "14px",
                    }}
                  >
                    {annualStats.averageRdvPerMonth}
                  </p>
                </div>

                {/* Row C — Statistiques annuelles */}
                <div className="border-t py-1">
                  <p
                    className="frame-title font-bold"
                    style={{
                      fontFamily: "Verdana,sans-serif",
                      fontSize: "11px",
                    }}
                  >
                    Statistiques annuelles {selectedYear}
                  </p>
                  <p
                    className="table-data text-muted-foreground"
                    style={{ fontSize: "9px" }}
                  >
                    Total reçu
                  </p>
                  <p
                    className="sum-total font-bold"
                    style={{
                      fontFamily: "Verdana,sans-serif",
                      fontSize: "14px",
                    }}
                  >
                    {formatNum(annualStats.totalRevenue)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── RIGHT COLUMN: E / F / G merged — Mois courant ── */}
            <div className="flex flex-col gap-4">
              <p
                className="text-center font-bold text-xl"
                style={{ fontFamily: "Verdana, sans-serif" }}
              >
                Mois de : {currentMonthLabel}
              </p>

              <Card>
                <CardContent className="px-4 py-2">
                  {/* Row E — Dus (RDV Faits ; Mois Courant) */}
                  <div className="py-1">
                    <p
                      className="frame-title font-bold"
                      style={{
                        fontFamily: "Verdana,sans-serif",
                        fontSize: "11px",
                      }}
                    >
                      Dus (RDV Faits ; Mois Courant)
                    </p>
                    <p
                      className="sum-total font-bold text-orange-600"
                      style={{
                        fontFamily: "Verdana,sans-serif",
                        fontSize: "14px",
                      }}
                    >
                      {formatNum(financialOverviewData.totalDue)}
                    </p>
                    <p
                      className="table-data text-muted-foreground"
                      style={{ fontSize: "9px" }}
                    >
                      Montants restant à percevoir
                    </p>
                  </div>

                  {/* Row F — RDV faits (Payés et Impayés ; Mois Courant) */}
                  <div className="border-t py-1">
                    <p
                      className="frame-title font-bold"
                      style={{
                        fontFamily: "Verdana,sans-serif",
                        fontSize: "11px",
                      }}
                    >
                      RDV faits (Payés et Impayés ; Mois Courant)
                    </p>
                    <p
                      className="sum-total font-bold text-blue-600"
                      style={{
                        fontFamily: "Verdana,sans-serif",
                        fontSize: "14px",
                      }}
                    >
                      {formatNum(
                        financialOverviewData.totalRdvFaitsMoisCourant,
                      )}
                    </p>
                    <p
                      className="table-data text-muted-foreground"
                      style={{ fontSize: "9px" }}
                    >
                      Total des montants dus pour les rendez-vous effectués
                    </p>
                  </div>

                  {/* Row G — Revenus du Mois en Cours (Faits et Payés) */}
                  <div className="border-t py-1">
                    <p
                      className="frame-title font-bold"
                      style={{
                        fontFamily: "Verdana,sans-serif",
                        fontSize: "11px",
                      }}
                    >
                      Revenus du Mois en Cours (Faits et Payés)
                    </p>
                    <p
                      className="sum-total font-bold text-green-600"
                      style={{
                        fontFamily: "Verdana,sans-serif",
                        fontSize: "14px",
                      }}
                    >
                      {formatNum(financialOverviewData.totalPaid)}
                    </p>
                    <p
                      className="table-data text-muted-foreground"
                      style={{ fontSize: "9px" }}
                    >
                      Montants perçus pour les rendez-vous effectués
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── CENTER COLUMN: D — Résumé Mensuels ── */}
          <div className="flex flex-col gap-4">
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
        </div>

        {/* ── FRAME H — Listing Mensuel (full width) ── */}
        <Card className="mb-6 w-full">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="frame-title">
                Listing Mensuel — {MONTH_NAMES[selectedMonth - 1]}{" "}
                {selectedYear}
              </CardTitle>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="p-1 rounded hover:bg-muted border border-border"
                  title="Mois précédent"
                >
                  &#8249;
                </button>
                <span
                  className="text-sm font-medium px-2"
                  style={{ fontFamily: "Verdana, sans-serif" }}
                >
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="p-1 rounded hover:bg-muted border border-border"
                  title="Mois suivant"
                >
                  &#8250;
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="ml-2 px-2 py-1 text-xs rounded border border-border hover:bg-muted"
                  style={{ fontFamily: "Verdana, sans-serif" }}
                >
                  Aujourd'hui
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 md:p-6">
            <div className="table-scroll-wrapper">
              <MonthlyListingTable
                listings={listings}
                totals={totals}
                allAppointments={allAppointments}
                year={selectedYear}
                month={selectedMonth}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
