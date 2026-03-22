# Mon Agenda Revenus — Version 177

## Current State
- WeeklyCalendarPage (Calendrier Semaine) : menu contextuel sur clic du nom ouvre un `EditModal` local (seulement heureDebut, heureFin, montantDu, service, notes) — formulaire incomplet
- DailyCalendarPage (Calendrier Journalier) : idem, EditModal local incomplet. Une seule ligne colorée pour chaque RDV. Colonnes Payé=47px, Date=40px. Tableau aligné à gauche.
- ClientDatabasePage : colonnes de la fiche "Date Pmt" et "Info" dans le tableau "Rendez-vous 2026". Boutons Fiche/Modifier/Supprimer à droite du tableau (dernier colonne)
- Payment dates stored in localStorage (weekly_payment_dates), notes via commentaireManuel in backend

## Requested Changes (Diff)

### Add
- (Point 2) DailyCalendarPage : coloration de toutes les lignes 15-min entre heureDebut et heureFin d'un RDV

### Modify
1. (Point 1) WeeklyCalendarPage ET DailyCalendarPage : remplacer EditModal local par AppointmentDialog (formulaire complet, même que Tableau de bord). Le menu contextuel doit utiliser DemandeEdition.unique/futursDuClient et ouvrir AppointmentDialog avec appointment + editMode. Ajouter aussi "Aller à la fiche client" dans le menu contextuel.
2. (Point 2) DailyCalendarPage : colorer toutes les lignes 15-min comprises dans la plage heureDebut→heureFin du RDV (fond vert pâle si fait, rose pâle si annulé, bleu pâle sinon)
3. (Point 3) DailyCalendarPage : col 7 (Payé) → 52px, col 8 (Date) → 44px. Centrer le tableau horizontalement dans la page (margin auto ou flex justify-center)
4. (Point 4) ClientDatabasePage : renommer "Date Pmt" → "Date" et "Info" → "Note" dans le tableau fiche client (affichage ET export HTML)
5. (Point 5) ClientDatabasePage : déplacer les boutons Fiche/Modifier/Supprimer en première colonne (avant Photo), supprimer la colonne Actions en fin de tableau
6. (Point 6) WeeklyCalendarPage : s'assurer que les dates de paiement ET les notes persistent correctement quand on change de page. Sauvegarder paymentDates dans localStorage sur chaque changement (déjà fait). Pour les notes (commentaireManuel), s'assurer que la mutation est bien appelée et que le champ utilise onBlur + onKeyDown Enter pour déclencher la sauvegarde plutôt qu'onChange (évite les sauvegardes intempestives)
7. (Point 7) Tous les champs de saisie (inputs, textareas) : ajouter onKeyDown avec validation sur touche Entrée (submit du formulaire ou blur du champ)

### Remove
- EditModal local dans WeeklyCalendarPage (remplacé par AppointmentDialog)
- EditModal local dans DailyCalendarPage (remplacé par AppointmentDialog)
- Colonne "Actions" en dernière position dans ClientDatabasePage (boutons déplacés à gauche)

## Implementation Plan
1. WeeklyCalendarPage :
   - Importer AppointmentDialog
   - Remplacer `EditModal` et `EditFormState` par AppointmentDialog (open={!!editForm} appointment={editForm?.apt} editMode={editForm?.mode === 'unique' ? DemandeEdition.unique : DemandeEdition.futursDuClient})
   - Ajouter "Aller à la fiche client" dans le menu contextuel
   - Note fields : utiliser valeur locale + onBlur/Enter pour sauvegarder via updateStatus
   - paymentDates : déjà persisté, vérifier que ça fonctionne bien
2. DailyCalendarPage :
   - Importer AppointmentDialog
   - Remplacer EditModal par AppointmentDialog
   - Construire un Set de slots couverts par chaque RDV (parser heureDebut/heureFin, trouver tous les slots TIME_SLOTS entre eux)
   - Appliquer la couleur background sur les colonnes Nom, Réf, F, A de chaque slot couvert
   - Changer col 7 (Payé) à 52px et col 8 (Date) à 44px
   - Envelopper le tableau dans un div centré (display:flex, justifyContent:center)
3. ClientDatabasePage :
   - Renommer "Date Pmt" → "Date" et "Info" → "Note" (HTML export + affichage)
   - Déplacer les boutons Fiche/Modifier/Supprimer en première colonne
4. Champs : ajouter onKeyDown Enter pour déclencher submit ou blur sur les inputs dans les formulaires de saisie
