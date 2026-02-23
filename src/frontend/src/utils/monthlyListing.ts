/**
 * Shared Monthly Listing calculation utilities
 * Rebuilt to use Calendar as the single source of truth
 * All calculations are pure functions without recursion or side effects
 * Uses a two-pass approach to correctly calculate credit carry-forward
 */

import type { DomaineListingMensuel, RendezVous } from '../backend';
import { bigintMin0, bigintMax0, bigintMin, bigintMax } from './bigintMath';

/**
 * Calculate "RDV Faits (Payés + impayés)" for a specific client and month
 * Source: Calendar appointments where "Fait" is checked
 * Sums all montantDu values for completed appointments
 */
export function calculateRdvFaits(
  referenceClient: string,
  allAppointments: RendezVous[],
  year: number,
  month: number
): bigint {
  const monthStart = BigInt(new Date(year, month - 1, 1).getTime()) * BigInt(1_000_000);
  const monthEnd = BigInt(new Date(year, month, 0, 23, 59, 59, 999).getTime()) * BigInt(1_000_000);
  
  return allAppointments
    .filter(apt => {
      const aptDate = apt.dateHeure;
      return apt.referenceClient === referenceClient && 
             aptDate >= monthStart && 
             aptDate <= monthEnd &&
             apt.fait === true; // Only count appointments marked as "Fait"
    })
    .reduce((sum, apt) => sum + apt.montantDu, BigInt(0));
}

/**
 * Calculate "Revenus + Avances (RDV Payés + Avances)" for a specific client and month
 * Source: Calendar appointments - sum all "Payé" field values
 */
export function calculateRevenusPlusAvances(
  referenceClient: string,
  allAppointments: RendezVous[],
  year: number,
  month: number
): bigint {
  const monthStart = BigInt(new Date(year, month - 1, 1).getTime()) * BigInt(1_000_000);
  const monthEnd = BigInt(new Date(year, month, 0, 23, 59, 59, 999).getTime()) * BigInt(1_000_000);
  
  return allAppointments
    .filter(apt => {
      const aptDate = apt.dateHeure;
      return apt.referenceClient === referenceClient && 
             aptDate >= monthStart && 
             aptDate <= monthEnd;
    })
    .reduce((sum, apt) => sum + apt.montantPaye, BigInt(0));
}

/**
 * Calculate "Crédit Positif" using Excel formula
 * Formula: E = MAX(0, A + D - B)
 * Where:
 * A = Crédit du mois précédent
 * B = RDV Faits (Payés + impayés)
 * D = Revenus + Avances (RDV Payés + Avances)
 */
export function calculateCreditPositif(
  creditPrecedent: bigint,
  revenusPlusAvances: bigint,
  rdvFaits: bigint
): bigint {
  const A = creditPrecedent;
  const D = revenusPlusAvances;
  const B = rdvFaits;
  
  return bigintMax0(A + D - B);
}

/**
 * Calculate "Crédit Négatif" using Excel formula
 * Formula: F = MIN(0, A + D - B)
 * Where:
 * A = Crédit du mois précédent
 * B = RDV Faits (Payés + impayés)
 * D = Revenus + Avances (RDV Payés + Avances)
 */
export function calculateCreditNegatif(
  creditPrecedent: bigint,
  revenusPlusAvances: bigint,
  rdvFaits: bigint
): bigint {
  const A = creditPrecedent;
  const D = revenusPlusAvances;
  const B = rdvFaits;
  
  return bigintMin0(A + D - B);
}

/**
 * Calculate "Revenus (Faits et Payés)" using Excel formula
 * Formula: IF(D + A > 0, MIN(B, D + MAX(0, A)), 0)
 * Where:
 * A = Crédit du mois précédent
 * B = RDV Faits (Payés + impayés)
 * D = Revenus + Avances (RDV Payés + Avances)
 */
export function calculateRevenusFaitsEtPayes(
  revenusPlusAvances: bigint,
  rdvFaits: bigint,
  creditPrecedent: bigint
): bigint {
  const D = revenusPlusAvances;
  const B = rdvFaits;
  const A = creditPrecedent;
  
  // IF(D + A > 0, MIN(B, D + MAX(0, A)), 0)
  if (D + A > BigInt(0)) {
    return bigintMin(B, D + bigintMax0(A));
  } else {
    return BigInt(0);
  }
}

/**
 * Intermediate calculation result for a single month
 * Used in the two-pass calculation approach
 */
interface MonthCalculation {
  month: number;
  rdvFaits: bigint;
  revenusPlusAvances: bigint;
  creditPositif: bigint;
  creditNegatif: bigint;
  creditTotal: bigint; // creditPositif + creditNegatif
}

/**
 * Two-pass calculation for all 12 months of a year for a specific client
 * Pass 1: Calculate all months independently with creditPrecedent = 0 (except January manual override)
 * Pass 2: Recalculate each month using the finalized creditTotal from the previous month
 */
export function calculateYearCreditsForClient(
  referenceClient: string,
  allAppointments: RendezVous[],
  year: number,
  manualJanuaryCredit?: bigint
): MonthCalculation[] {
  const months: MonthCalculation[] = [];
  
  // PASS 1: Calculate all 12 months independently
  for (let month = 1; month <= 12; month++) {
    const rdvFaits = calculateRdvFaits(referenceClient, allAppointments, year, month);
    const revenusPlusAvances = calculateRevenusPlusAvances(referenceClient, allAppointments, year, month);
    
    // For pass 1, use 0 as creditPrecedent (except January which can have manual override)
    const creditPrecedent = (month === 1 && manualJanuaryCredit !== undefined) ? manualJanuaryCredit : BigInt(0);
    
    const creditPositif = calculateCreditPositif(creditPrecedent, revenusPlusAvances, rdvFaits);
    const creditNegatif = calculateCreditNegatif(creditPrecedent, revenusPlusAvances, rdvFaits);
    const creditTotal = creditPositif + creditNegatif;
    
    months.push({
      month,
      rdvFaits,
      revenusPlusAvances,
      creditPositif,
      creditNegatif,
      creditTotal,
    });
  }
  
  // PASS 2: Recalculate each month using the finalized creditTotal from previous month
  for (let i = 1; i < 12; i++) {
    const currentMonth = months[i];
    const previousMonth = months[i - 1];
    
    // Use the previous month's total credit as this month's creditPrecedent
    const creditPrecedent = previousMonth.creditTotal;
    
    // Recalculate with correct creditPrecedent
    currentMonth.creditPositif = calculateCreditPositif(creditPrecedent, currentMonth.revenusPlusAvances, currentMonth.rdvFaits);
    currentMonth.creditNegatif = calculateCreditNegatif(creditPrecedent, currentMonth.revenusPlusAvances, currentMonth.rdvFaits);
    currentMonth.creditTotal = currentMonth.creditPositif + currentMonth.creditNegatif;
  }
  
  return months;
}

/**
 * Calculate "Crédit du mois précédent" for a specific client and month
 * Uses the two-pass calculation to ensure correct values
 */
export function calculateCreditDuMoisPrecedent(
  referenceClient: string,
  allAppointments: RendezVous[],
  currentYear: number,
  currentMonth: number,
  manualJanuaryCredit?: bigint
): bigint {
  // For January, return 0 by default (or manual override if provided)
  if (currentMonth === 1) {
    return manualJanuaryCredit ?? BigInt(0);
  }
  
  // Calculate all months for the year using two-pass approach
  const yearCalculations = calculateYearCreditsForClient(
    referenceClient,
    allAppointments,
    currentYear,
    manualJanuaryCredit
  );
  
  // Return the creditTotal from the previous month
  const previousMonthIndex = currentMonth - 2; // -1 for previous month, -1 for 0-based index
  return yearCalculations[previousMonthIndex].creditTotal;
}

/**
 * Calculate all monthly listing values for a single client row
 * This is a pure function that computes all columns in one pass
 */
export interface MonthlyListingRow {
  referenceClient: string;
  nomClient: string;
  nbRendezVousFaits: number;
  creditDuMoisPrecedent: bigint;
  rdvFaits: bigint;
  revenusFaitsEtPayes: bigint;
  revenusPlusAvances: bigint;
  creditPositif: bigint;
  creditNegatif: bigint;
}

export function calculateMonthlyListingRow(
  referenceClient: string,
  nomClient: string,
  allAppointments: RendezVous[],
  year: number,
  month: number,
  manualJanuaryCredit?: bigint
): MonthlyListingRow {
  // Step 1: Calculate "Crédit du mois précédent" using two-pass approach
  const creditDuMoisPrecedent = calculateCreditDuMoisPrecedent(
    referenceClient,
    allAppointments,
    year,
    month,
    manualJanuaryCredit
  );
  
  // Step 2: Calculate "RDV Faits (Payés + impayés)"
  const rdvFaits = calculateRdvFaits(referenceClient, allAppointments, year, month);
  
  // Step 3: Calculate "Revenus + Avances (RDV Payés + Avances)"
  const revenusPlusAvances = calculateRevenusPlusAvances(referenceClient, allAppointments, year, month);
  
  // Step 4: Calculate "Revenus (Faits et Payés)"
  const revenusFaitsEtPayes = calculateRevenusFaitsEtPayes(revenusPlusAvances, rdvFaits, creditDuMoisPrecedent);
  
  // Step 5: Calculate "Crédit Positif"
  const creditPositif = calculateCreditPositif(creditDuMoisPrecedent, revenusPlusAvances, rdvFaits);
  
  // Step 6: Calculate "Crédit Négatif"
  const creditNegatif = calculateCreditNegatif(creditDuMoisPrecedent, revenusPlusAvances, rdvFaits);
  
  // Count number of completed appointments
  const monthStart = BigInt(new Date(year, month - 1, 1).getTime()) * BigInt(1_000_000);
  const monthEnd = BigInt(new Date(year, month, 0, 23, 59, 59, 999).getTime()) * BigInt(1_000_000);
  const nbRendezVousFaits = allAppointments.filter(apt => {
    return apt.referenceClient === referenceClient &&
           apt.dateHeure >= monthStart &&
           apt.dateHeure <= monthEnd &&
           apt.fait === true;
  }).length;
  
  return {
    referenceClient,
    nomClient,
    nbRendezVousFaits,
    creditDuMoisPrecedent,
    rdvFaits,
    revenusFaitsEtPayes,
    revenusPlusAvances,
    creditPositif,
    creditNegatif,
  };
}

/**
 * Calculate total "Revenus (Faits et Payés)" for all clients
 */
export function calculateTotalRevenusFaitsEtPayes(
  rows: MonthlyListingRow[]
): bigint {
  return rows.reduce((sum, row) => sum + row.revenusFaitsEtPayes, BigInt(0));
}

/**
 * Calculate total "Revenus + Avances (RDV Payés + Avances)" for all clients
 */
export function calculateTotalRevenusPlusAvances(
  rows: MonthlyListingRow[]
): bigint {
  return rows.reduce((sum, row) => sum + row.revenusPlusAvances, BigInt(0));
}

/**
 * Calculate total "Crédit Positif" for all clients
 */
export function calculateTotalCreditPositif(
  rows: MonthlyListingRow[]
): bigint {
  return rows.reduce((sum, row) => sum + row.creditPositif, BigInt(0));
}

/**
 * Calculate total "Crédit Négatif" for all clients
 */
export function calculateTotalCreditNegatif(
  rows: MonthlyListingRow[]
): bigint {
  return rows.reduce((sum, row) => sum + row.creditNegatif, BigInt(0));
}

/**
 * Generate HTML table for Monthly Listing (for PDF export)
 */
export function generateMonthlyListingHTML(
  rows: MonthlyListingRow[]
): string {
  const formatNumber = (amount: bigint | number) => Number(amount).toLocaleString('fr-FR');
  
  const formatBalance = (balance: bigint) => {
    const numBalance = Number(balance);
    const isPositive = numBalance >= 0;
    const className = isPositive ? 'positive' : 'negative';
    const sign = isPositive ? '+' : '';
    return `<span class="${className}">${sign}${numBalance.toLocaleString('fr-FR')}</span>`;
  };
  
  // Calculate totals
  const totalNbRdv = rows.reduce((sum, r) => sum + r.nbRendezVousFaits, 0);
  const totalRdvFaits = rows.reduce((sum, r) => sum + r.rdvFaits, BigInt(0));
  const totalRevenus = calculateTotalRevenusFaitsEtPayes(rows);
  const totalSommesRecues = calculateTotalRevenusPlusAvances(rows);
  const totalCreditPositif = calculateTotalCreditPositif(rows);
  const totalCreditNegatif = calculateTotalCreditNegatif(rows);
  
  const rowsHTML = rows.map(row => {
    return `
      <tr>
        <td>${row.referenceClient}</td>
        <td>${row.nomClient}</td>
        <td class="number">${row.nbRendezVousFaits}</td>
        <td class="number">${formatBalance(row.creditDuMoisPrecedent)}</td>
        <td class="number">${formatNumber(row.rdvFaits)}</td>
        <td class="number">${formatNumber(row.revenusFaitsEtPayes)}</td>
        <td class="number">${formatNumber(row.revenusPlusAvances)}</td>
        <td class="number">${row.creditPositif > BigInt(0) ? formatBalance(row.creditPositif) : '0'}</td>
        <td class="number">${row.creditNegatif < BigInt(0) ? formatBalance(row.creditNegatif) : '0'}</td>
      </tr>
    `;
  }).join('');
  
  return `
    <table class="monthly-listing">
      <thead>
        <tr>
          <th>Réf</th>
          <th>Nom</th>
          <th class="number">Nbr</th>
          <th class="number">Crédit du mois précédent</th>
          <th class="number">RDV Faits (Payés + impayés)</th>
          <th class="number">Revenus (Faits et Payés)</th>
          <th class="number">Revenus + Avances (RDV Payés + Avances)</th>
          <th class="number">Crédit Positif</th>
          <th class="number">Crédit Négatif</th>
        </tr>
      </thead>
      <tbody>
        <tr class="total-row">
          <td colspan="2"><strong>TOTAL</strong></td>
          <td class="number"><strong>${totalNbRdv}</strong></td>
          <td class="number"><strong>-</strong></td>
          <td class="number"><strong>${formatNumber(totalRdvFaits)}</strong></td>
          <td class="number"><strong>${formatNumber(totalRevenus)}</strong></td>
          <td class="number"><strong>${formatNumber(totalSommesRecues)}</strong></td>
          <td class="number"><strong>${formatBalance(totalCreditPositif)}</strong></td>
          <td class="number"><strong>${formatBalance(totalCreditNegatif)}</strong></td>
        </tr>
        ${rowsHTML}
      </tbody>
    </table>
  `;
}

// Legacy compatibility exports
export const calculateToutesSommesRecues = calculateRevenusPlusAvances;
export const calculateRdvDuMoisFaitsEtPayes = calculateRevenusFaitsEtPayes;
export const calculateClientRevenusFaitsEtPayes = calculateRevenusFaitsEtPayes;
export const calculateTotalRdvDuMoisFaitsEtPayes = calculateTotalRevenusFaitsEtPayes;
export const calculateTotalToutesSommesRecues = calculateTotalRevenusPlusAvances;
