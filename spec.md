# Mon Agenda Revenus

## Current State
- MonthlyCalendarPage: colonnes 100px, légende avec texte 'Signification des couleurs :', pas de bordure arrondie sur le tableau, aligné à gauche
- WeeklyCalendarPage: Nom=110px, Dû=51px, Payé=52px, Date=52px; SummaryBox bug sur desktop (textes se chevauchent quand sub-label présent)
- DailyCalendarPage: Nom=100px, Dû=47px, Payé=52px, Date=44px; en-tête colonnes gris clair #f3f4f6
- ClientFicheModal (dans les 3 pages): colonne 'Date Pmt' dans le tableau RDV, pas de colonne 'Crédit'

## Requested Changes (Diff)

### Add
- MonthlyCalendarPage: bordure arrondie (border-radius 8px, border 1px solid #d1d5db) autour du tableau entier; centrage du tableau dans la page
- ClientFicheModal (3 pages): colonne 'Crédit' dans le tableau Rendez-vous (montantPaye - montantDu si fait, sinon montantPaye)

### Modify
- MonthlyCalendarPage: COL_W 100→87px; supprimer le span 'Signification des couleurs :' (garder les swatches); uniformiser la couleur des séparateurs de colonnes (#d1d5db partout)
- WeeklyCalendarPage DAY_COLS: nom 110→88, dû 51→44, payé 52→44, date 52→44; mettre à jour toutes les références hardcodées à ces largeurs dans DayBox render; corriger le SummaryBox (rendre chaque ligne height:auto, padding suffisant pour éviter overflow du texte)
- DailyCalendarPage COLS: nom 100→88, dû 47→44, payé 52→44; en-tête colonnes en bleu pâle #dbeafe; mettre à jour toutes les références hardcodées à ces largeurs dans le render
- ClientFicheModal (3 pages): renommer 'Date Pmt' → 'Date' dans l'en-tête du tableau RDV

### Remove
- Rien

## Implementation Plan
1. MonthlyCalendarPage: COL_W=87, retirer le span 'Signification des couleurs :', entourer le tableau d'un div avec border 1px solid #d1d5db + borderRadius 8 + overflow hidden, centrer avec justifyContent center, uniformiser borderRight à #d1d5db dans tous les th/td
2. WeeklyCalendarPage: mettre à jour DAY_COLS et toutes les valeurs hardcodées (88, 44, 44, 44), corriger SummaryBox (height auto, minHeight 16px, padding 2px)
3. DailyCalendarPage: mettre à jour COLS et toutes les valeurs hardcodées (88, 44, 44), header background #dbeafe
4. ClientFicheModal dans les 3 fichiers: headers ['Date', 'Heure', 'Dû', 'Payé', 'Date', 'Note', 'Crédit', 'Fait'], ajouter cellule Crédit = montantPaye - (fait ? montantDu : 0)
