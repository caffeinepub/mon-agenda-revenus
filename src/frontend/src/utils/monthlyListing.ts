/**
 * Shared Monthly Listing calculation utilities
 * Ensures consistent calculations across Dashboard and Rapport PDF
 * All revenue calculations use "Revenus (Faits et Payés)" as the authoritative concept
 */

import type { DomaineListingMensuel, RendezVous } from '../backend';
import { bigintMin0, bigintMax0, bigintMin, bigintMax } from './bigintMath';

/**
 * Calculate "Revenus + Avances (RDV Payés + Avances)" for a specific client
 */
export function calculateToutesSommesRecues(
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
 * Get previous month's credit for a client
 * For January, looks up December of the previous year if data is provided
 * Returns 0 if previous month data is not available
 */
export function getPreviousMonthCredit(
  currentMonth: number,
  currentYear: number,
  referenceClient: string,
  previousMonthListings: DomaineListingMensuel[] | undefined
): bigint {
  // If no previous month data is available, return 0
  if (!previousMonthListings) {
    return BigInt(0);
  }
  
  // Find the client in previous month's data
  const previousClient = previousMonthListings.find(c => c.referenceClient === referenceClient);
  if (!previousClient) {
    return BigInt(0);
  }
  
  // Return the previous month's ending balance (soldeRestant)
  return previousClient.soldeRestant;
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
 * Legacy alias for backward compatibility
 * @deprecated Use calculateRevenusFaitsEtPayes instead
 */
export function calculateRdvDuMoisFaitsEtPayes(
  revenusPlusAvances: bigint,
  rdvFaits: bigint,
  creditPrecedent: bigint
): bigint {
  return calculateRevenusFaitsEtPayes(revenusPlusAvances, rdvFaits, creditPrecedent);
}

/**
 * Calculate "Revenus (Faits et Payés)" from a client listing object (legacy compatibility)
 * Uses the backend-provided totalPayeMois as "Revenus + Avances"
 */
export function calculateRdvDuMoisFaitsEtPayesFromClient(
  client: DomaineListingMensuel
): bigint {
  // For backward compatibility, use totalPayeMois as revenusPlusAvances
  // and assume creditPrecedent is 0 (will be overridden when proper data is available)
  const revenusPlusAvances = client.totalPayeMois;
  const rdvFaits = client.totalDuMois;
  const creditPrecedent = BigInt(0); // Default, should be provided separately
  
  return calculateRevenusFaitsEtPayes(revenusPlusAvances, rdvFaits, creditPrecedent);
}

/**
 * Calculate "Crédit Positif" using Excel formula
 * Formula: MAX(0, A + D - B)
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
 * Formula: MIN(0, A + D - B)
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
 * Calculate total "Revenus (Faits et Payés)" for all clients
 */
export function calculateTotalRevenusFaitsEtPayes(
  listings: DomaineListingMensuel[],
  allAppointments: RendezVous[],
  year: number,
  month: number,
  previousMonthListings: DomaineListingMensuel[] | undefined
): bigint {
  return listings.reduce((sum, client) => {
    const creditPrecedent = getPreviousMonthCredit(month, year, client.referenceClient, previousMonthListings);
    const revenusPlusAvances = calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
    const rdvFaits = client.totalDuMois;
    
    return sum + calculateRevenusFaitsEtPayes(revenusPlusAvances, rdvFaits, creditPrecedent);
  }, BigInt(0));
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use calculateTotalRevenusFaitsEtPayes instead
 */
export function calculateTotalRdvDuMoisFaitsEtPayes(
  listings: DomaineListingMensuel[],
  allAppointments: RendezVous[],
  year: number,
  month: number,
  previousMonthListings: DomaineListingMensuel[] | undefined
): bigint {
  return calculateTotalRevenusFaitsEtPayes(listings, allAppointments, year, month, previousMonthListings);
}

/**
 * Calculate "Revenus (Faits et Payés)" for a specific client
 */
export function calculateClientRevenusFaitsEtPayes(
  client: DomaineListingMensuel,
  allAppointments: RendezVous[],
  year: number,
  month: number,
  previousMonthListings: DomaineListingMensuel[] | undefined
): bigint {
  const creditPrecedent = getPreviousMonthCredit(month, year, client.referenceClient, previousMonthListings);
  const revenusPlusAvances = calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
  const rdvFaits = client.totalDuMois;
  
  return calculateRevenusFaitsEtPayes(revenusPlusAvances, rdvFaits, creditPrecedent);
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use calculateClientRevenusFaitsEtPayes instead
 */
export function calculateClientRdvDuMoisFaitsEtPayes(
  client: DomaineListingMensuel,
  allAppointments: RendezVous[],
  year: number,
  month: number,
  previousMonthListings: DomaineListingMensuel[] | undefined
): bigint {
  return calculateClientRevenusFaitsEtPayes(client, allAppointments, year, month, previousMonthListings);
}

/**
 * Calculate total "Revenus + Avances (RDV Payés + Avances)" for all clients
 */
export function calculateTotalToutesSommesRecues(
  listings: DomaineListingMensuel[],
  allAppointments: RendezVous[],
  year: number,
  month: number
): bigint {
  return listings.reduce((sum, client) => {
    return sum + calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
  }, BigInt(0));
}

/**
 * Calculate total "Crédit Positif" for all clients
 */
export function calculateTotalCreditPositif(
  listings: DomaineListingMensuel[],
  allAppointments: RendezVous[],
  year: number,
  month: number,
  previousMonthListings: DomaineListingMensuel[] | undefined
): bigint {
  return listings.reduce((sum, client) => {
    const creditPrecedent = getPreviousMonthCredit(month, year, client.referenceClient, previousMonthListings);
    const revenusPlusAvances = calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
    const rdvFaits = client.totalDuMois;
    
    return sum + calculateCreditPositif(creditPrecedent, revenusPlusAvances, rdvFaits);
  }, BigInt(0));
}

/**
 * Calculate total "Crédit Négatif" for all clients
 */
export function calculateTotalCreditNegatif(
  listings: DomaineListingMensuel[],
  allAppointments: RendezVous[],
  year: number,
  month: number,
  previousMonthListings: DomaineListingMensuel[] | undefined
): bigint {
  return listings.reduce((sum, client) => {
    const creditPrecedent = getPreviousMonthCredit(month, year, client.referenceClient, previousMonthListings);
    const revenusPlusAvances = calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
    const rdvFaits = client.totalDuMois;
    
    return sum + calculateCreditNegatif(creditPrecedent, revenusPlusAvances, rdvFaits);
  }, BigInt(0));
}

/**
 * Generate HTML table for Monthly Listing (for PDF export)
 */
export function generateMonthlyListingHTML(
  listings: DomaineListingMensuel[],
  allAppointments: RendezVous[],
  year: number,
  month: number,
  previousMonthListings: DomaineListingMensuel[] | undefined
): string {
  const formatNumber = (amount: bigint | number) => Number(amount).toLocaleString('fr-FR');
  
  const formatBalance = (balance: bigint) => {
    const numBalance = Number(balance);
    const isPositive = numBalance >= 0;
    const className = isPositive ? 'positive' : 'negative';
    const sign = isPositive ? '+' : '';
    return `<span class="${className}">${sign}${numBalance.toLocaleString('fr-FR')}</span>`;
  };
  
  // Calculate totals using Excel formulas
  const totalNbRdv = listings.reduce((sum, c) => sum + Number(c.nbRendezVousFaits), 0);
  const totalRdvFaits = listings.reduce((sum, c) => sum + c.totalDuMois, BigInt(0));
  const totalRevenus = calculateTotalRevenusFaitsEtPayes(listings, allAppointments, year, month, previousMonthListings);
  const totalSommesRecues = calculateTotalToutesSommesRecues(listings, allAppointments, year, month);
  const totalCreditPositif = calculateTotalCreditPositif(listings, allAppointments, year, month, previousMonthListings);
  const totalCreditNegatif = calculateTotalCreditNegatif(listings, allAppointments, year, month, previousMonthListings);
  
  const rows = listings.map(client => {
    const creditPrecedent = getPreviousMonthCredit(month, year, client.referenceClient, previousMonthListings);
    const revenusPlusAvances = calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
    const rdvFaits = client.totalDuMois;
    
    const revenus = calculateRevenusFaitsEtPayes(revenusPlusAvances, rdvFaits, creditPrecedent);
    const creditPositif = calculateCreditPositif(creditPrecedent, revenusPlusAvances, rdvFaits);
    const creditNegatif = calculateCreditNegatif(creditPrecedent, revenusPlusAvances, rdvFaits);
    
    return `
      <tr>
        <td>${client.referenceClient}</td>
        <td>${client.nomClient}</td>
        <td class="number">${Number(client.nbRendezVousFaits)}</td>
        <td class="number">${formatBalance(creditPrecedent)}</td>
        <td class="number">${formatNumber(rdvFaits)}</td>
        <td class="number">${formatNumber(revenus)}</td>
        <td class="number">${formatNumber(revenusPlusAvances)}</td>
        <td class="number">${creditPositif > BigInt(0) ? formatBalance(creditPositif) : '0'}</td>
        <td class="number">${creditNegatif < BigInt(0) ? formatBalance(creditNegatif) : '0'}</td>
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
        ${rows}
      </tbody>
    </table>
  `;
}
