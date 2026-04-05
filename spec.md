src/frontend/src/i18n/ - système i18n créé avec fr.json, en.json, es.json, ru.json
src/frontend/src/hooks/useTranslation.ts - hook useTranslation créé

Tâches frontend à implémenter :

1. CORRECTION COLONNE "Dû" dans MonthlySummarySection.tsx :
   - Remplacer le calcul `duAujourdhui` par : `totalRdvFaits - totalRevenue`
   - Supprimer la dépendance à `allAppointments` dans ce calcul
   - Afficher le résultat en ROUGE (text-red-600) — jamais en orange
   - Le résultat est TOUJOURS positif ou nul (rdvFaits >= revenus par définition)
   - Supprimer l'ancien calcul `duAujourdhui` basé sur les appointments individuels
   - Nouveau code : `const duTotal = totalRdvFaits - totalRevenue;`
   - Affichage uniquement dans la ligne TOTAL (pas dans les lignes mensuelles)

2. SYSTÈME i18n — MIGRATION DES TEXTES VISIBLES :
   Hook disponible : `import { useTranslation } from "../hooks/useTranslation";`
   (ou `"../../hooks/useTranslation"` selon le chemin)
   Utilisation : `const { t } = useTranslation();` puis `t("section.key")`
   Fichier de référence des clés : src/frontend/src/i18n/fr.json

   Appliquer useTranslation() dans ces fichiers :
   - components/Header.tsx
   - components/MonthlySummarySection.tsx
   - components/AppointmentDialog.tsx
   - components/AppointmentActionDialog.tsx
   - components/AppointmentDeleteDialog.tsx
   - components/ClientPhotoField.tsx
   - pages/Dashboard.tsx
   - pages/ClientDatabasePage.tsx
   - pages/UserManagementPage.tsx
   - pages/WeeklyCalendarPage.tsx
   - pages/DailyCalendarPage.tsx
   - pages/MonthlyCalendarPage.tsx
   - pages/RapportPDFPage.tsx

   Éléments à migrer (PAS tout le texte, seulement les éléments VISIBLES) :
   - Tous les titres de pages (h1, CardTitle)
   - Tous les labels de colonnes de tableaux (TableHead)
   - Tous les boutons (Button, texte des boutons)
   - Tous les labels de formulaires (Label)
   - Tous les messages toast (toast.success, toast.error)
   - Les noms des éléments de navigation (Header)
   - Les en-têtes de cartes (CardTitle)
   - Les messages de confirmation de suppression

   NE PAS migrer :
   - Les constantes de données (MONTH_NAMES, DAY_NAMES utilisées pour les calculs)
   - Le code logique, les valeurs de champs de formulaire
   - Les chaînes utilisées dans des comparaisons

3. SÉLECTEUR DE LANGUE dans Header.tsx :
   - Ajouter un sélecteur de langue visible dans la barre de navigation
   - Placer entre les boutons de navigation et le bouton Sync Google
   - Afficher les drapeaux emoji + code langue : 🇫🇷 FR | 🇬🇧 EN | 🇪🇸 ES | 🇷🇺 RU
   - Utiliser un DropdownMenu avec la liste de toutes les langues disponibles (getAllLanguages())
   - Importez : `import { useTranslation, getAllLanguages, setActiveLanguage } from "../hooks/useTranslation";`
   - Le changement est instantané (l'event agenda_lang_change déclenche re-render)
   - Sur mobile : ajouter aussi dans le menu dropdown

4. PAGE LANGUES (nouveau fichier src/frontend/src/pages/LanguagesPage.tsx) :
   Créer une nouvelle page complète avec :
   a) Section "Langues disponibles" : tableau listant toutes les langues (code, nom, drapeau, intégré/personnalisé)
      - Langue active est indiquée visuellement (badge ou fond coloré)
      - Bouton "Activer" pour changer de langue
      - Bouton "Supprimer" (uniquement pour les langues personnalisées, pas les intégrées)
      - Bouton "Télécharger" pour exporter n'importe quelle langue
   b) Section "Exporter un fichier de langue" :
      - Sélecteur de langue à exporter (toutes les langues disponibles)
      - Bouton Télécharger → génère un fichier JSON `{code}.json` à télécharger
   c) Section "Importer un fichier de langue" :
      - Champ upload fichier JSON
      - Champ saisie code langue (ex: DE)
      - Champ saisie nom affiché (ex: Deutsch)
      - Champ optionnel emoji drapeau
      - Bouton Importer → appelle saveCustomLanguage() et ajoute au sélecteur immédiatement
      - Si le code existe déjà (même les intégrés), remplace sans confirmation

   Imports pour la page :
   ```ts
   import { useTranslation, getAllLanguages, saveCustomLanguage, deleteCustomLanguage, setActiveLanguage, getActiveLanguageCode } from "../hooks/useTranslation";
   ```

5. ROUTE dans App.tsx :
   - Ajouter route `/languages` → LanguagesPage
   - Ajouter lien "Langues" dans la navigation Header (uniquement pour admin)
     Icône : Languages (from lucide-react) ou Globe
   - Ajouter aussi dans le menu mobile dropdown

CONTRAINTES IMPORTANTES :
- Ne pas toucher aux formules de calcul (useGetMonthlyListing, calculateMonthlyListingRow, etc.)
- Ne pas toucher aux structures de données, types TypeScript
- Ne pas modifier les colonnes/dimensions des tableaux calendriers
- Les MONTH_NAMES et DAY_NAMES pour les calculs restent en français (données)
- Le hook useTranslation est déjà créé dans src/frontend/src/hooks/useTranslation.ts
- Les fichiers i18n sont déjà créés dans src/frontend/src/i18n/
- Valider avec typecheck et build après les modifications
