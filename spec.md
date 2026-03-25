# Mon Agenda Revenus — Version 182

## Current State
Application React/TypeScript avec backend Motoko. Pages principales : Tableau de bord, Calendrier Semaine (WeeklyCalendarPage), Calendrier Journalier (DailyCalendarPage), Calendrier Mensuel (MonthlyCalendarPage), Base Client, Rapport PDF, Utilisateurs. La synchronisation backend Motoko est en place mais les dates de paiement (weekly_payment_dates) ne sont pas incluses. Le Tableau de bord contient le ComptaMoisCalendarTable.

## Requested Changes (Diff)

### Add
- Filtrage par jour de la semaine dans les opérations "futursDuClient" (update + delete)
- Menu contextuel dans MonthlyCalendarPage au clic sur un nom (Modifier ce RDV / Modifier tous les futurs / Supprimer ce RDV / Voir la fiche client)
- Surbrillance jaune pâle sur la case du jour actuel dans WeeklyCalendarPage

### Modify
- `backendSync.ts` : inclure `weekly_payment_dates` dans syncToBackend/syncFromBackend
- `localDataStore.ts` : ajouter filtre weekday dans updateAppointment et deleteAppointment pour mode futursDuClient
- `WeeklyCalendarPage.tsx` : corriger champ Payé (width, curseur visible, pas de zéro auto), jour actuel en jaune
- `DailyCalendarPage.tsx` : corriger champ Payé (même corrections)
- `MonthlyCalendarPage.tsx` : remplacer clic direct fiche client par menu contextuel avec AppointmentDialog
- `Dashboard.tsx` : supprimer le bloc ComptaMoisCalendarTable (Frame I)

### Remove
- Import et rendu de `ComptaMoisCalendarTable` dans `Dashboard.tsx`

## Implementation Plan
1. `backendSync.ts` — ajouter `weekly_payment_dates` dans les fonctions sync
2. `localDataStore.ts` — dans `updateAppointment` et `deleteAppointment`, pour `futursDuClient`, ajouter condition `getDay() === targetDay` sur la date
3. `WeeklyCalendarPage.tsx` — champ Payé: utiliser état local + onFocus sélectionne tout, width correct, outline visible au focus; case du jour actuel: fond jaune pâle `#fef9c3` sur le header du DayBox
4. `DailyCalendarPage.tsx` — même corrections pour le champ Payé
5. `MonthlyCalendarPage.tsx` — ajouter imports AppointmentDialog/DemandeEdition, état contextMenu, menu 4 options, fonctions onDelete/onOpenEdit
6. `Dashboard.tsx` — supprimer le Card "Calendrier mensuel" (Frame I) et les imports/usages liés
