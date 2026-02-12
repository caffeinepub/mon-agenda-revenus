import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DomaineListingMensuel, TotauxListingMensuel, RendezVous } from '../backend';
import {
  calculateRevenusFaitsEtPayes,
  calculateTotalRevenusFaitsEtPayes,
  calculateToutesSommesRecues,
  calculateTotalToutesSommesRecues,
  getPreviousMonthCredit,
  calculateCreditPositif,
  calculateCreditNegatif,
  calculateTotalCreditPositif,
  calculateTotalCreditNegatif,
} from '../utils/monthlyListing';

interface MonthlyListingTableProps {
  listings: DomaineListingMensuel[];
  totals: TotauxListingMensuel | null;
  allAppointments: RendezVous[];
  year: number;
  month: number;
  previousMonthListings?: DomaineListingMensuel[];
}

export default function MonthlyListingTable({
  listings,
  totals,
  allAppointments,
  year,
  month,
  previousMonthListings,
}: MonthlyListingTableProps) {
  const formatNumber = (amount: bigint | number) => {
    return Number(amount).toLocaleString('fr-FR');
  };

  const formatBalance = (balance: bigint, showSign: boolean = true) => {
    const numBalance = Number(balance);
    const isPositive = numBalance >= 0;
    const className = isPositive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
    const sign = showSign && isPositive ? '+' : '';
    return (
      <span className={className}>
        {sign}{numBalance.toLocaleString('fr-FR')}
      </span>
    );
  };

  // Calculate totals using Excel formulas
  const totalRevenusFaitsEtPayes = useMemo(() => {
    return calculateTotalRevenusFaitsEtPayes(listings, allAppointments, year, month, previousMonthListings);
  }, [listings, allAppointments, year, month, previousMonthListings]);

  const totalToutesSommesRecues = useMemo(() => {
    return calculateTotalToutesSommesRecues(listings, allAppointments, year, month);
  }, [listings, allAppointments, year, month]);

  const totalCreditPositif = useMemo(() => {
    return calculateTotalCreditPositif(listings, allAppointments, year, month, previousMonthListings);
  }, [listings, allAppointments, year, month, previousMonthListings]);

  const totalCreditNegatif = useMemo(() => {
    return calculateTotalCreditNegatif(listings, allAppointments, year, month, previousMonthListings);
  }, [listings, allAppointments, year, month, previousMonthListings]);

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
              Réf
            </TableHead>
            <TableHead className="font-semibold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
              Nom
            </TableHead>
            <TableHead className="text-center font-semibold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
              Nbr
            </TableHead>
            <TableHead className="text-right font-semibold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
              Crédit du mois précédent
            </TableHead>
            <TableHead className="text-right font-semibold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
              RDV Faits (Payés + impayés)
            </TableHead>
            <TableHead className="text-right font-semibold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
              Revenus (Faits et Payés)
            </TableHead>
            <TableHead className="text-right font-semibold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
              Revenus + Avances (RDV Payés + Avances)
            </TableHead>
            <TableHead className="text-right font-semibold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
              Crédit Positif
            </TableHead>
            <TableHead className="text-right font-semibold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
              Crédit Négatif
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Total Row */}
          {totals && (
            <TableRow className="bg-muted/50 font-bold">
              <TableCell colSpan={2} className="font-bold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                TOTAL
              </TableCell>
              <TableCell className="text-center font-bold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                {Number(totals.totalNbRendezVousFaits)}
              </TableCell>
              <TableCell className="text-right font-bold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                -
              </TableCell>
              <TableCell className="text-right font-bold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                {formatNumber(totals.totalDuMois)}
              </TableCell>
              <TableCell className="text-right font-bold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                {formatNumber(totalRevenusFaitsEtPayes)}
              </TableCell>
              <TableCell className="text-right font-bold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                {formatNumber(totalToutesSommesRecues)}
              </TableCell>
              <TableCell className="text-right font-bold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                {formatBalance(totalCreditPositif, false)}
              </TableCell>
              <TableCell className="text-right font-bold" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                {formatBalance(totalCreditNegatif, false)}
              </TableCell>
            </TableRow>
          )}
          
          {/* Client Rows */}
          {listings.map((client) => {
            const creditPrecedent = getPreviousMonthCredit(month, year, client.referenceClient, previousMonthListings);
            const revenusPlusAvances = calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
            const rdvFaits = client.totalDuMois;
            
            const revenus = calculateRevenusFaitsEtPayes(revenusPlusAvances, rdvFaits, creditPrecedent);
            const creditPositif = calculateCreditPositif(creditPrecedent, revenusPlusAvances, rdvFaits);
            const creditNegatif = calculateCreditNegatif(creditPrecedent, revenusPlusAvances, rdvFaits);
            
            return (
              <TableRow key={client.referenceClient}>
                <TableCell className="text-muted-foreground font-medium" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                  {client.referenceClient}
                </TableCell>
                <TableCell className="font-medium" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                  {client.nomClient}
                </TableCell>
                <TableCell className="text-center" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                  {Number(client.nbRendezVousFaits)}
                </TableCell>
                <TableCell className="text-right" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                  {formatBalance(creditPrecedent)}
                </TableCell>
                <TableCell className="text-right" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                  {formatNumber(rdvFaits)}
                </TableCell>
                <TableCell className="text-right" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                  {formatNumber(revenus)}
                </TableCell>
                <TableCell className="text-right" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                  {formatNumber(revenusPlusAvances)}
                </TableCell>
                <TableCell className="text-right" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                  {creditPositif > BigInt(0) ? formatBalance(creditPositif, false) : '0'}
                </TableCell>
                <TableCell className="text-right" style={{ fontFamily: 'Cambria, serif', fontSize: '10px' }}>
                  {creditNegatif < BigInt(0) ? formatBalance(creditNegatif, false) : '0'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
