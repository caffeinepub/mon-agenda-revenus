import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import MonthlyListingTable from "../components/MonthlyListingTable";
import MonthlySummarySection from "../components/MonthlySummarySection";
import {
  useGetAllAppointments,
  useGetMonthlyListing,
} from "../hooks/useQueries";
import { useTranslation } from "../hooks/useTranslation";

// MONTH_NAMES defined inside component

export default function Dashboard() {
  const { t } = useTranslation();
  const MONTH_NAMES = [
    t("months.janvier"),
    t("months.fevrier"),
    t("months.mars"),
    t("months.avril"),
    t("months.mai"),
    t("months.juin"),
    t("months.juillet"),
    t("months.aout"),
    t("months.septembre"),
    t("months.octobre"),
    t("months.novembre"),
    t("months.decembre"),
  ];
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

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-2 py-4 md:px-4 md:py-8">
        <h1 className="frame-title text-2xl md:text-3xl mb-4 md:mb-6">
          {t("dashboard.title")}
        </h1>

        {/* ── TOP SECTION: Résumé Mensuels ── */}
        <div className="mb-6">
          <p
            className="text-center font-bold text-xl mb-3"
            style={{ fontFamily: "Verdana, sans-serif" }}
          >
            {t("dashboard.annee")} : {selectedYear}
          </p>
          <MonthlySummarySection
            year={selectedYear}
            allAppointments={allAppointments}
          />
        </div>

        {/* ── FRAME H — Listing Mensuel (full width) ── */}
        <Card className="mb-6 w-full">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="frame-title">
                {t("dashboard.listingMensuel")} —{" "}
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </CardTitle>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="p-1 rounded hover:bg-muted border border-border"
                  title={t("monthly.prevMonth")}
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
                  title={t("monthly.nextMonth")}
                >
                  &#8250;
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="ml-2 px-2 py-1 text-xs rounded border border-border hover:bg-muted"
                  style={{ fontFamily: "Verdana, sans-serif" }}
                >
                  {t("dashboard.today")}
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
