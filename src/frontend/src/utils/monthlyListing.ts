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
 * Returns the ending credit balance from the previous month (sum of Crédit Positif + Crédit Négatif)
 * This represents the total credit generated in month N-1: A(N-1) + D(N-1) - B(N-1)
 */
export function getPreviousMonthCredit(
  currentMonth: number,
  currentYear: number,
  referenceClient: string,
  previousMonthListings: DomaineListingMensuel[] | undefined,
  allAppointments?: RendezVous[]
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
  
  // Calculate the previous month's ending credit balance
  // This is the sum of Crédit Positif + Crédit Négatif from month N-1
  // Formula: A(N-1) + D(N-1) - B(N-1)
  // Where:
  // A(N-1) = previous month's previous credit (we need to recurse or use stored value)
  // D(N-1) = Revenus + Avances from month N-1
  // B(N-1) = RDV Faits from month N-1
  
  // If we have appointments data, calculate it properly
  if (allAppointments) {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    // We need the previous month's previous credit (A for month N-1)
    // This would require recursive lookup, but we can use the backend's creditCumule
    // or calculate from the stored data
    
    // For now, use the soldeRestant which represents D - B
    // But we need to add the previous credit carryover
    // The creditFinMois field should contain the ending balance
    return previousClient.creditFinMois;
  }
  
  // Fallback: use creditFinMois which should represent the ending credit balance
  return previousClient.creditFinMois;
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
 */
export function calculateRevenusFaitsEtPayesFromListing(
  client: DomaineListingMensuel,
  allAppointments: RendezVous[],
  year: number,
  month: number,
  previousMonthListings: DomaineListingMensuel[] | undefined
): bigint {
  const creditPrecedent = getPreviousMonthCredit(month, year, client.referenceClient, previousMonthListings, allAppointments);
  const revenusPlusAvances = calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
  const rdvFaits = client.totalDuMois;
  
  return calculateRevenusFaitsEtPayes(revenusPlusAvances, rdvFaits, creditPrecedent);
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
  return listings.reduce((total, client) => {
    return total + calculateRevenusFaitsEtPayesFromListing(client, allAppointments, year, month, previousMonthListings);
  }, BigInt(0));
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
  return listings.reduce((total, client) => {
    return total + calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
  }, BigInt(0));
}

/**
 * Calculate "Crédit Positif" using Excel formula
 * Formula: MAX(0, A + D - B)
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
 * Calculate total "Crédit Positif" for all clients
 */
export function calculateTotalCreditPositif(
  listings: DomaineListingMensuel[],
  allAppointments: RendezVous[],
  year: number,
  month: number,
  previousMonthListings: DomaineListingMensuel[] | undefined
): bigint {
  return listings.reduce((total, client) => {
    const creditPrecedent = getPreviousMonthCredit(month, year, client.referenceClient, previousMonthListings, allAppointments);
    const revenusPlusAvances = calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
    const rdvFaits = client.totalDuMois;
    
    const creditPositif = calculateCreditPositif(creditPrecedent, revenusPlusAvances, rdvFaits);
    return total + creditPositif;
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
  return listings.reduce((total, client) => {
    const creditPrecedent = getPreviousMonthCredit(month, year, client.referenceClient, previousMonthListings, allAppointments);
    const revenusPlusAvances = calculateToutesSommesRecues(client.referenceClient, allAppointments, year, month);
    const rdvFaits = client.totalDuMois;
    
    const creditNegatif = calculateCreditNegatif(creditPrecedent, revenusPlusAvances, rdvFaits);
    return total + creditNegatif;
  }, BigInt(0));
}
