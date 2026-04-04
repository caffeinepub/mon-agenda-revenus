# Mon Agenda Revenus

## Current State

- `MonthlySummarySection.tsx`: Tableau "Résumé Mensuels (Année en Cours)" avec 2 colonnes : Mois + Revenus (Faits et Payés). Calculs via `calculateMonthlyListingRow` et `calculateTotalRevenusFaitsEtPayes`.
- `UserManagementPage.tsx`: Section apparence avec mode clair/sombre et option police orangée (une seule option checkbox). En mode sombre, certains fonds restent blancs et la police blanche devient illisible.
- `ClientDatabasePage.tsx`: Formulaire "Ajouter un client" avec champ Nom obligatoire + champ Référence client éditable à tout moment (même après création). Pas de génération automatique de référence.
- `monthlyListing.ts`: Utilitaire de calcul avec `calculateRevenusPlusAvances` (= sommes reçues = montantPaye de tous les RDV du mois).

## Requested Changes (Diff)

### Add
- Dans `MonthlySummarySection.tsx`: 2 nouvelles colonnes dans le tableau Résumé Mensuels:
  1. "RDV Faits (payé et impayés)" — nombre total de RDV fait par mois (= `rdvFaits` de chaque client, somme)
  2. "Sommes reçus" — total des sommes reçues par mois (= `calculateRevenusPlusAvances` = somme des `montantPaye` de tous RDV du mois, tous clients confondus)
- Dans `UserManagementPage.tsx` section apparence: Remplacer la simple case à cocher police orangée par un sélecteur de couleurs de police avec plusieurs options prédéfinies visibles sur fond sombre ET fond clair.
- Dans `ClientDatabasePage.tsx`: Génération automatique d'une référence client unique lors de la création (format ex: CLI-2026-001, incrémentée). Le champ référence est éditable uniquement à la création, verrouillé dès que le client est sauvegardé.

### Modify
- Dans `UserManagementPage.tsx` et `index.css`: Corriger le mode sombre — s'assurer que tous les tableaux et fonds blancs/très clairs ont une couleur de fond sombre, ou que le texte qui passe en blanc est foncé suffisamment pour rester lisible sur fond clair.
- Dans `ClientDatabasePage.tsx`: Le champ Nom client n'est plus obligatoire (validation `handleSubmit` à corriger : ne plus exiger `clientName`).
- Dans `MonthlySummarySection.tsx`: Ligne de total en haut du tableau inclut les 2 nouvelles colonnes.

### Remove
- Dans `UserManagementPage.tsx`: Supprimer la simple checkbox "Police orangée" et la remplacer par le nouveau sélecteur multi-couleurs.

## Implementation Plan

1. **MonthlySummarySection.tsx** — Ajouter le calcul de `rdvFaits` total par mois et `sommesRecues` total par mois. Ajouter 2 colonnes dans le TableHeader et les TableRow. Mettre à jour la ligne TOTAL en conséquence.

2. **UserManagementPage.tsx** — Section apparence:
   a. Remplacer checkbox "Police orangée" par une palette de 6 couleurs prédéfinies (ex: blanc, orange, jaune, vert pâle, cyan, gris clair) avec un swatch visuel cliquable. La couleur sélectionnée est stockée dans `localStorage` (clé `agenda_font_color`). Une option "Défaut" remet à la couleur native.
   b. Identifier et corriger les fonds blancs en mode sombre : ajouter des classes dark: sur les divs inline-styled, ou forcer `bg-background` / `dark:bg-gray-800` sur les zones incriminées.

3. **ClientDatabasePage.tsx** — Formulaire:
   a. Générer automatiquement une référence au format `CLI-AAAA-NNN` (année courante + numéro séquentiel à partir du nombre de clients existants + 1) quand `editingClientId` est null et que la référence est vide.
   b. Rendre le champ référence readOnly quand `editingClientId` n'est pas null (client existant).
   c. Retirer `clientName` de la validation obligatoire dans `handleSubmit` — autoriser nom vide.

4. **index.css ou App.tsx** — Appliquer la couleur de police personnalisée depuis `localStorage` `agenda_font_color` dans la classe CSS `--font-color-custom` ou via un effet qui applique le style inline sur `document.documentElement`.

5. **Code cleanup** — Supprimer imports inutilisés, console.log, variables inutilisées.
