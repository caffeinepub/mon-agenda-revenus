import { useMemo, useState } from 'react';
import { useGetMonthlyListing, useGetAllAppointments } from '../hooks/useQueries';
import FinancialOverview from '../components/FinancialOverview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Calendar, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import MonthlyListingTable from '../components/MonthlyListingTable';
import { calculateTotalRevenusFaitsEtPayes, calculateTotalCreditNegatif } from '../utils/monthlyListing';
import { bigintAbs } from '../utils/bigintMath';

const MONTHS_SHORT = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
];

const MONTHS_FULL = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function Dashboard() {
  // Get current month listing for calculations
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  // State for monthly listing table navigation
  const [listingYear, setListingYear] = useState(currentYear);
  const [listingMonth, setListingMonth] = useState(currentMonth);
  
  const { data: currentMonthListingData } = useGetMonthlyListing(currentYear, currentMonth);
  const { data: listingData, isLoading: listingLoading } = useGetMonthlyListing(listingYear, listingMonth);
  const { data: allAppointments } = useGetAllAppointments();
  
  // Fetch previous month's listing for "Crédit du mois précédent" column
  const previousMonth = listingMonth === 1 ? 12 : listingMonth - 1;
  const previousYear = listingMonth === 1 ? listingYear - 1 : listingYear;
  const { data: previousMonthListingData } = useGetMonthlyListing(previousYear, previousMonth);

  // Fetch previous month for current month (for Dashboard cards)
  const currentPreviousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const currentPreviousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const { data: currentPreviousMonthListingData } = useGetMonthlyListing(currentPreviousYear, currentPreviousMonth);

  // Fetch monthly listings for all months of the current year
  const monthlyListingQueries = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useGetMonthlyListing(currentYear, month);
  });

  // Fetch previous month data for each month (for credit calculations)
  // For January, fetch December of the previous year
  const previousMonthQueries = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? currentYear - 1 : currentYear;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useGetMonthlyListing(prevYear, prevMonth);
  });

  // "RDV faits (Payés et Impayés ; Mois Courant)"
  // Source : totalDuMois du mois courant (colonne 5 du Listing Mensuel)
  const totalRdvFaitsMoisCourant = useMemo(() => {
    if (!currentMonthListingData || !currentMonthListingData[1]) return BigInt(0);
    return currentMonthListingData[1].totalDuMois;
  }, [currentMonthListingData]);

  // "Dus (RDV Faits ; Mois Courant)"
  // Source : Calculé depuis le tableau intégré en utilisant la formule Excel pour "Crédit Négatif"
  // Utilise la même fonction que MonthlyListingTable pour garantir la cohérence
  const montantsDus = useMemo(() => {
    if (!currentMonthListingData || !currentMonthListingData[0] || !allAppointments) return BigInt(0);
    
    const listings = currentMonthListingData[0];
    const previousMonthListings = currentPreviousMonthListingData ? currentPreviousMonthListingData[0] : undefined;
    
    // Calculate total "Crédit Négatif" using the same Excel formula as Monthly Listing table
    const totalCreditNegatif = calculateTotalCreditNegatif(
      listings,
      allAppointments,
      currentYear,
      currentMonth,
      previousMonthListings
    );
    
    // Return absolute value (negative credit is displayed as positive amount due)
    return bigintAbs(totalCreditNegatif);
  }, [currentMonthListingData, allAppointments, currentYear, currentMonth, currentPreviousMonthListingData]);

  // "Revenus du Mois en Cours (Faits et Payés)"
  // Source : Calculé depuis le tableau intégré en utilisant la formule Excel
  const revenusPercus = useMemo(() => {
    if (!currentMonthListingData || !currentMonthListingData[0] || !allAppointments) return BigInt(0);
    
    const listings = currentMonthListingData[0];
    const previousMonthListings = currentPreviousMonthListingData ? currentPreviousMonthListingData[0] : undefined;
    
    return calculateTotalRevenusFaitsEtPayes(listings, allAppointments, currentYear, currentMonth, previousMonthListings);
  }, [currentMonthListingData, allAppointments, currentYear, currentMonth, currentPreviousMonthListingData]);

  // "Revenus Mensuels 2026 (RDV Faits et payés)" et "Statistiques annuelles 2026"
  // Source : Somme des 12 valeurs mensuelles de la colonne "Revenus (Faits et Payés)" du tableau intégré
  // Calcul identique à celui utilisé dans le tableau : utilise la formule Excel
  const yearlyStats = useMemo(() => {
    if (!allAppointments) {
      return {
        monthlyTotals: {},
        totalReceived: BigInt(0),
        averageMonthly: 0,
        completelyElapsedMonths: 0,
      };
    }

    const monthlyTotals: { [key: number]: bigint } = {};
    
    // Pour chaque mois : calculer le total de "Revenus (Faits et Payés)"
    // en utilisant la MÊME formule que dans le tableau intégré
    for (let i = 1; i <= 12; i++) {
      const queryData = monthlyListingQueries[i - 1].data;
      const previousMonthData = previousMonthQueries[i - 1].data;
      
      if (queryData && queryData[0]) {
        const listings = queryData[0];
        const previousMonthListings = previousMonthData ? previousMonthData[0] : undefined;
        
        monthlyTotals[i] = calculateTotalRevenusFaitsEtPayes(
          listings,
          allAppointments,
          currentYear,
          i,
          previousMonthListings
        );
      } else {
        monthlyTotals[i] = BigInt(0);
      }
    }

    // Calculer le total annuel : somme des 12 mois
    let totalReceived = BigInt(0);
    
    for (let i = 1; i <= 12; i++) {
      totalReceived += monthlyTotals[i];
    }
    
    // Moyenne sur les mois ENTIÈREMENT ÉCOULÉS uniquement
    const completelyElapsedMonths = currentMonth - 1;
    
    // Calculer le total uniquement pour les mois entièrement écoulés
    let totalForCompleteMonths = BigInt(0);
    for (let i = 1; i <= completelyElapsedMonths; i++) {
      totalForCompleteMonths += monthlyTotals[i];
    }
    
    const averageMonthly = completelyElapsedMonths > 0 
      ? Number(totalForCompleteMonths) / completelyElapsedMonths 
      : 0;

    return {
      monthlyTotals,
      totalReceived,
      averageMonthly,
      completelyElapsedMonths,
    };
  }, [monthlyListingQueries, previousMonthQueries, allAppointments, currentMonth, currentYear]);

  // Extract listings and totals from the tuple returned by backend
  const listing = listingData ? listingData[0] : [];
  const totals = listingData ? listingData[1] : null;
  const previousMonthListings = previousMonthListingData ? previousMonthListingData[0] : undefined;

  const handlePreviousMonth = () => {
    if (listingMonth === 1) {
      setListingMonth(12);
      setListingYear(listingYear - 1);
    } else {
      setListingMonth(listingMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (listingMonth === 12) {
      setListingMonth(1);
      setListingYear(listingYear + 1);
    } else {
      setListingMonth(listingMonth + 1);
    }
  };

  const formatNumber = (amount: bigint | number) => {
    return Number(amount).toLocaleString('fr-FR');
  };

  const isLoading = monthlyListingQueries.some(q => q.isLoading);

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Tableau de bord</h2>
        <p className="text-muted-foreground">Gérez vos rendez-vous et suivez vos revenus</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Financial Overview Cards */}
          <FinancialOverview
            totalDue={montantsDus}
            totalPaid={revenusPercus}
            totalRdvFaitsMoisCourant={totalRdvFaitsMoisCourant}
          />

          {/* Annual Financial Summary */}
          <div className="mb-8 grid gap-4 md:grid-cols-2">
            {/* Revenus Mensuels 2026 (RDV Faits et payés) - Valeurs lues DIRECTEMENT depuis le tableau intégré */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenus Mensuels 2026 (RDV Faits et payés)</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {Object.entries(yearlyStats.monthlyTotals).map(([month, total]) => {
                      const monthNum = parseInt(month);
                      return (
                        <div 
                          key={month} 
                          className="flex justify-between p-2 rounded bg-muted/50"
                        >
                          <span className="font-medium">{MONTHS_SHORT[monthNum - 1]}</span>
                          <span className="text-green-600 font-semibold">
                            {formatNumber(total)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Valeurs calculées depuis la colonne "Revenus (Faits et Payés)" du tableau "Listing mensuel"
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Statistiques annuelles 2026 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Statistiques annuelles {currentYear}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total reçu, année en cours (RDV faits et payés)</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatNumber(yearlyStats.totalReceived)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Somme des 12 mois de "Revenus (Faits et Payés)"
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Revenu mensuel moyen ({yearlyStats.completelyElapsedMonths} {yearlyStats.completelyElapsedMonths <= 1 ? 'mois écoulé' : 'mois écoulés'})
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatNumber(yearlyStats.averageMonthly)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Listing Table */}
          <Card className="mt-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Listing Mensuel</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Récapitulatif des rendez-vous et finances par client
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousMonth}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Mois précédent
                </Button>
                <h2 className="text-xl font-semibold">
                  {MONTHS_FULL[listingMonth - 1]} {listingYear}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextMonth}
                  className="gap-2"
                >
                  Mois suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Loading State */}
              {listingLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
                    <p className="text-muted-foreground">Chargement du listing...</p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!listingLoading && listing.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun rendez-vous</h3>
                  <p className="text-muted-foreground">
                    Aucun rendez-vous effectué pour ce mois.
                  </p>
                </div>
              )}

              {/* Listing Table */}
              {!listingLoading && listing.length > 0 && allAppointments && (
                <MonthlyListingTable
                  listings={listing}
                  totals={totals}
                  allAppointments={allAppointments}
                  year={listingYear}
                  month={listingMonth}
                  previousMonthListings={previousMonthListings}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
