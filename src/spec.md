# Specification

## Summary
**Goal:** Fix the Dashboard card “Dus (RDV Faits ; Mois Courant)” so its displayed due amount matches the “Listing Mensuel” total for “Crédit Négatif” for the current month.

**Planned changes:**
- Update the Dashboard “Dus (RDV Faits ; Mois Courant)” calculation to reuse the same negative-credit computation logic used by the Monthly Listing table (monthlyListing.ts Excel-formula calculation), instead of using the backend field totalSoldeRestantNegatif.
- Ensure the Dashboard uses the same required inputs as the Monthly Listing logic (current month listings, previous month listings for carry-over, and all appointments) so results do not diverge between the Dashboard card and the Monthly Listing table.

**User-visible outcome:** The Dashboard “Dus (RDV Faits ; Mois Courant)” card shows the same value as the Monthly Listing “Crédit Négatif” total for the current month (e.g., February displays 0 instead of 4400 when the Monthly Listing shows 0).
