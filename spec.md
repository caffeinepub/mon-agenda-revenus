# Mon Agenda Revenus

## Current State
- Page Calendrier Semaine : lignes de 24px, fiche client redirige vers /client-database, 9 colonnes synchronisées avec calendrier mensuel
- Page Base Client : tableau Liste des clients avec colonnes fixes, fiche client avec tableau Rendez-vous 2026 (sans colonne Date), stockage localStorage+backend
- Stockage : syncFromBackend au démarrage, syncToBackendBackground après mutations

## Requested Changes (Diff)

### Add
- Colonne Date dans tableau Rendez-vous 2026 de la fiche client (Base Client), lisant weekly_payment_dates du localStorage
- Page Calendrier Journalier : 7h-22h par tranches de 15 minutes, hauteur 12px par ligne, 9 colonnes mêmes données que Calendrier Semaine, synchronisée avec le même store de données, navigation jour par jour, colonnes : 47/100/51/24/24/47/47/40/74 px
- Route /calendrier-journalier dans App.tsx et menu dans Header

### Modify
- WeeklyCalendarPage : ROW_H 24→12 (hauteur des lignes)
- WeeklyCalendarPage : onViewClient reçoit referenceClient+clientName, affiche fiche dans une modale overlay (plus de redirection vers /client-database)
- ClientDatabasePage : colonnes du tableau Liste des clients en auto-fit (sans scroll horizontal)
- BackendSync : améliorer robustesse (retry + log)

### Remove
- Aucune suppression

## Implementation Plan
1. WeeklyCalendarPage.tsx : ROW_H=12, modifier DayBoxProps.onViewClient(ref, name), gérer modal fiche dans WeeklyCalendarPage
2. ClientDatabasePage.tsx : colonnes table auto (no fixed widths), ajouter colonne Date dans rdvList (lire weekly_payment_dates)
3. Créer DailyCalendarPage.tsx : slots 15min de 7h à 22h, hauteur fixe 12px, 9 colonnes, navigation jour, synchronisé avec allAppointments, actions identiques (clic nom = menu modif/suppr/fiche)
4. App.tsx : ajouter route dailyCalendarRoute
5. Header.tsx : ajouter lien Calendrier Journalier
