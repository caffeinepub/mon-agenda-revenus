import { useState, useMemo } from 'react';
import { useGetAllAppointments, useGetMonthlyListing } from '../hooks/useQueries';
import FinancialOverview from '../components/FinancialOverview';
import MonthlyListingTable from '../components/MonthlyListingTable';
import ComptaMoisCalendarTable from '../components/ComptaMoisCalendarTable';
import MonthlySummarySection from '../components/MonthlySummarySection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  calculateMonthlyListingRow, 
  calculateTotalRevenusFaitsEtPayes,
  calculateTotalCreditNegatif,
  type MonthlyListingRow
} from '../utils/monthlyListing';
import { bigintAbs } from '../utils/bigintMath';

export default function Dashboard() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  const { data: allAppointments = [] } = useGetAllAppointments();
  const { data: monthlyListingData } = useGetMonthlyListing(selectedYear, selectedMonth);

  const listings = monthlyListingData?.[0] ?? [];
  const totals = monthlyListingData?.[1] ?? null;

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const handlePreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Calculate monthly revenues for the entire year (used by MonthlySummarySection)
  const monthlyRevenues = useMemo(() => {
    const revenues: bigint[] = [];

    for (let month = 1; month <= 12; month++) {
      const monthStart = BigInt(new Date(selectedYear, month - 1, 1).getTime()) * BigInt(1_000_000);
      const monthEnd = BigInt(new Date(selectedYear, month, 0, 23, 59, 59, 999).getTime()) * BigInt(1_000_000);
      
      const clientsInMonth = new Map<string, string>();
      allAppointments.forEach(apt => {
        if (apt.dateHeure >= monthStart && apt.dateHeure <= monthEnd) {
          clientsInMonth.set(apt.referenceClient, apt.nomClient);
        }
      });

      const rows = Array.from(clientsInMonth.entries()).map(([referenceClient, nomClient]) => {
        return calculateMonthlyListingRow(
          referenceClient,
          nomClient,
          allAppointments,
          selectedYear,
          month
        );
      });

      const monthRevenue = calculateTotalRevenusFaitsEtPayes(rows);
      revenues.push(monthRevenue);
    }

    return revenues;
  }, [selectedYear, allAppointments]);

  // Calculate rows for the selected month using the same logic as MonthlyListingTable
  // This ensures consistency between the table display and the financial cards
  const calculatedRows = useMemo<MonthlyListingRow[]>(() => {
    return listings.map(client => {
      return calculateMonthlyListingRow(
        client.referenceClient,
        client.nomClient,
        allAppointments,
        selectedYear,
        selectedMonth
      );
    });
  }, [listings, allAppointments, selectedYear, selectedMonth]);

  // Calculate financial overview data by referencing existing sections
  const financialOverviewData = useMemo(() => {
    // Card G: Revenus du Mois en Cours (Faits et Payés) 
    // Source: Résumé Mensuels table, column "Revenus (Faits et Payés)" for selected month
    const selectedMonthIndex = selectedMonth - 1; // 0-based index
    const totalPaid = monthlyRevenues[selectedMonthIndex] ?? BigInt(0);

    // Card E: Dus (RDV Faits ; Mois Courant)
    // Source: Listing Mensuel table, sum of "Crédit Négatif" column (negative creditNegatif values)
    // This represents amounts owed by clients (negative balances)
    const creditNegatifTotal = calculateTotalCreditNegatif(calculatedRows);

    // Card F: RDV faits (Payés et Impayés ; Mois Courant)
    // Source: Listing Mensuel table, sum of "RDV Faits (Payés + impayés)" column (rdvFaits)
    // FIXED: Now correctly summing rdvFaits instead of revenusFaitsEtPayes
    const totalRdvFaitsMoisCourant = calculatedRows.reduce(
      (sum, row) => sum + row.rdvFaits,
      BigInt(0)
    );

    return {
      totalDue: bigintAbs(creditNegatifTotal), // Display as positive value
      totalPaid,
      totalRdvFaitsMoisCourant,
    };
  }, [selectedMonth, monthlyRevenues, calculatedRows]);

  // Calculate annual statistics
  const annualStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    // 3. Statistiques annuelles 2026 - sum of all 12 months from Résumé Mensuels
    let totalRevenue = BigInt(0);
    monthlyRevenues.forEach(revenue => {
      totalRevenue += revenue;
    });

    // 4. Revenu moyen 2026 - average of only completed months (months before current month)
    const completedMonthsCount = selectedYear < currentYear ? 12 : (selectedYear === currentYear ? currentMonth - 1 : 0);
    
    let totalCompletedRevenue = BigInt(0);
    for (let i = 0; i < completedMonthsCount; i++) {
      totalCompletedRevenue += monthlyRevenues[i];
    }

    const averageRevenue = completedMonthsCount > 0
      ? totalCompletedRevenue / BigInt(completedMonthsCount)
      : BigInt(0);

    return {
      totalRevenue,
      averageRevenue,
      completedMonthsCount,
    };
  }, [monthlyRevenues, selectedYear]);

  // Create Date object for ComptaMoisCalendarTable
  const calendarDate = useMemo(() => {
    return new Date(selectedYear, selectedMonth - 1, 1);
  }, [selectedYear, selectedMonth]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <h1 className="frame-title text-3xl mb-8">Tableau de bord</h1>

        {/* Financial Overview Cards */}
        <FinancialOverview
          totalDue={financialOverviewData.totalDue}
          totalPaid={financialOverviewData.totalPaid}
          totalRdvFaitsMoisCourant={financialOverviewData.totalRdvFaitsMoisCourant}
        />

        {/* Annual Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="frame-title">Statistiques annuelles {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="table-data text-muted-foreground">Total reçu</p>
              <p className="sum-total">{Number(annualStats.totalRevenue).toLocaleString('fr-FR')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="frame-title">Revenu moyen {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="table-data text-muted-foreground">
                Basé sur {annualStats.completedMonthsCount} mois terminé{annualStats.completedMonthsCount > 1 ? 's' : ''}
              </p>
              <p className="sum-total">{Number(annualStats.averageRevenue).toLocaleString('fr-FR')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Summary Section */}
        <MonthlySummarySection
          year={selectedYear}
          allAppointments={allAppointments}
        />

        {/* Monthly Listing Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="frame-title">Listing Mensuel</CardTitle>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="frame-title min-w-[200px] text-center">
                  {monthNames[selectedMonth - 1]} {selectedYear}
                </span>
                <Button variant="outline" size="sm" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
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

        {/* Calendar Section */}
        <Card>
          <CardHeader>
            <CardTitle className="frame-title">Calendrier mensuel</CardTitle>
          </CardHeader>
          <CardContent>
            <ComptaMoisCalendarTable
              initialMonth={calendarDate}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
