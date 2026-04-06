# Mon Agenda Revenus

## Current State

L'application est une application multi-pages de gestion d'agenda pour indépendants. Les pages concernées par ce diff sont :
- `WeeklyCalendarPage.tsx` : Calendrier Semaine avec champs Note éditables dans chaque ligne
- `DailyCalendarPage.tsx` : Calendrier Journalier avec champs Note éditables
- `MonthlyCalendarPage.tsx` : Calendrier Mensuel (pas de champ Note éditable dans la grille, seulement la fiche client en lecture seule)
- `ClientDatabasePage.tsx` : Base Client avec panneau gauche toujours visible (mode `panelMode` géré mais initialisé à `"form"`) et bouton "Ajouter un Client" dupliqué dans chaque ligne
- `UserManagementPage.tsx` : Page Utilisateurs avec quelques textes en dur
- `i18n/fr.json` + autres langues : système i18n existant

## Requested Changes (Diff)

### Add
- Composant local `NoteCell` (ou hook) dans WeeklyCalendarPage et DailyCalendarPage : état local pour la valeur saisie, sauvegarde uniquement au `onBlur` ou touche `Enter`
- Nouvelles clés i18n dans `fr.json`, `en.json`, `ru.json`, `es.json` pour les textes manquants

### Modify

**Fix 1 — Saisie Note trop lente (WeeklyCalendarPage + DailyCalendarPage) :**
Le champ Note est contrôlé (`value={apt.commentaireManuel}`) et appelle `updateStatus.mutate()` à chaque `onChange`, ce qui provoque un re-render et perd les frappes rapides. Solution : créer un composant `NoteCell` React avec son propre `useState(initialValue)`, binding local sur `onChange`, et sauvegarde vers le backend uniquement sur `onBlur` ou `Enter`. La valeur locale doit se réinitialiser si `apt.commentaireManuel` change depuis l'extérieur (utiliser `useEffect` avec comparaison).

**Fix 2 — Bouton "Ajouter un Client" dans chaque ligne (ClientDatabasePage) :**
Dans le `TableBody`, chaque `TableRow` contient un bouton "Ajouter un Client" (UserPlus) qui est incorrect. Supprimer ce bouton dans les lignes client — seul le bouton en haut du tableau (dans `CardHeader`) doit rester.

**Fix 3 — Panneau gauche caché par défaut (ClientDatabasePage) :**
- Changer `useState<PanelMode>("form")` → `useState<PanelMode | null>(null)` (ou une valeur sentinelle `"hidden"`)
- En temps normal (state `null`/`"hidden"`), le panneau gauche n'est PAS rendu → le tableau "Liste des clients" prend toute la largeur (`lg:col-span-3` ou full width)
- Cliquer sur "Ajouter un Client" → `setPanelMode("form")` ET `resetForm()` (pour générer une nouvelle référence auto)
- Cliquer sur "Modifier" dans une ligne → `setPanelMode("form")` + remplir le formulaire (comportement actuel `handleClientSelect`)
- Cliquer sur "Fiche" dans une ligne → `setPanelMode("fiche")` (comportement actuel)
- Fermer le panneau (croix X dans la fiche ou annulation formulaire) → `setPanelMode(null)` pour le masquer
- Quand panelMode est non-null, la grille est `grid-cols-1 lg:grid-cols-3` avec le panneau gauche en `lg:col-span-1` et la liste en `lg:col-span-2`
- Quand panelMode est null, pas de panneau gauche et la liste prend toute la largeur

**Fix 4 — Textes en dur restants :**
- `ClientDatabasePage.tsx` : remplacer tous les textes visibles en dur par `t("...")` :
  - Titres du formulaire : "Modifier le client" / "Ajouter un client"
  - Descriptions du formulaire
  - Labels : "Nom du client (optionnel)", "Prénom (optionnel)", "Référence client *", "Téléphone", "Adresse", "Service", "Notes", "Courriel 1", "Courriel 2", "Date de naissance", "Nom Second contact", "Téléphone second contact"
  - Bouton submit : "Mettre à jour" / "Ajouter"
  - Bouton annuler : "Annuler"
  - Placeolders : "Prénom du client", "Référence client...", etc.
  - Dans la fiche client : "Fiche client", "Exporter en HTML", "Modifier", "Nom", "Prénom", "Référence", "Téléphone", "Adresse", "Service", "Notes", "Courriel 1", "Courriel 2", "Date de naissance", "Nom Second contact", "Téléphone second contact", "Résumé", "Nb de RDV", "Total payé", "Montant impayé", "Date", "Note", "Fait", "Crédit", "Total"
  - Dans le panneau recherche : "Rechercher un client", labels "Nom", "Référence", "Téléphone", "Service", placeholders
  - Dans le tableau : "Actions", "Photo", "Nom", "Référence", "Téléphone", "Adresse", "Service", "Notes", "Payé en 2026" → `Payé en {year}`, "Fiche", "Modifier", "Aucun client enregistré", "Rechercher", "Ordre original", "Tri A-Z"
  - Messages d'erreur : "Non autorisé : ...", "Chargement..."
  - "Fiche client exportée en HTML"
- `UserManagementPage.tsx` : remplacer :
  - `"Copier l'URL générée et la coller dans le champ ci-dessus"` → `t("users.step4")`
  - placeholder `"Entrez votre mot de passe secret"` → `t("users.googleSecretPlaceholder")`
  - placeholder `"Nouveau mot de passe"` → `t("users.nouveauMotDePasse")` (déjà dans fr.json)
  - placeholder `"Identifiant"` → `t("users.identifiant")`
  - placeholder `"Mot de passe"` → `t("users.password")`
  - `title={showSecret ? "Masquer" : "Afficher"}` → `t("users.hidePassword")` / `t("users.showPassword")`
  - erreur fallback `"Erreur"` → `t("common.error")`

### Remove
- Bouton "Ajouter un Client" dans chaque ligne du tableau Base Client
- Panneau gauche affiché par défaut au chargement de la page Base Client

## Implementation Plan

1. Créer composant `NoteCell` dans WeeklyCalendarPage et DailyCalendarPage (état local + sauvegarde onBlur/Enter)
2. Modifier ClientDatabasePage :
   a. `panelMode` initialisé à `null` au lieu de `"form"`
   b. Supprimer le bouton "Ajouter un Client" dans les lignes
   c. Adapter le rendu : panneau gauche conditionnel, liste pleine largeur quand null
   d. Remplacer tous les textes en dur par `t("...")`
3. Modifier UserManagementPage : remplacer les 5-6 textes en dur restants
4. Ajouter les clés manquantes dans fr.json et les traduire dans en.json, ru.json, es.json
