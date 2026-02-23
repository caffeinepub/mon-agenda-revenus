# Specification

## Summary
**Goal:** Fix dashboard financial calculations by retrieving values directly from existing data sections instead of recalculating them.

**Planned changes:**
- Update 'Revenus du Mois en Cours (Faits et Payés)' card to retrieve the amount directly from the 'Résumé Mensuels (Année en Cours)' section for the selected month
- Update 'Dus (RDV Faits ; Mois Courant)' card to retrieve the total directly from the 'Crédit Négatif' column in the 'Listing Mensuel' section
- Update 'RDV faits (Payés et Impayés ; Mois Courant)' card to retrieve the total directly from the 'Revenus (Faits et Payés)' column in the 'Listing Mensuel' section
- Ensure all three cards update automatically when the month selector in 'Listing Mensuel' changes

**User-visible outcome:** Dashboard financial cards display accurate values that match the corresponding sections and update correctly when changing the selected month.
