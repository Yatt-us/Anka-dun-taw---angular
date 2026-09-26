# Organisation du front-end Anka Dùn Taw

Angular 22 + Angular Material/CDK 22.2.0 + HTML + CSS/SCSS + SVG. Material fournit les cartes, boutons, menus, tableaux, champs, pagination, fenêtres de détail et messages de confirmation. Les graphiques restent en SVG, sans bibliothèque de graphiques supplémentaire. Poppins est chargée depuis `public/fonts/`, sans requête vers Google Fonts.

## Où modifier chaque écran

| Écran                           | Dossier                                          |
| ------------------------------- | ------------------------------------------------ |
| Choisir un espace               | `features/auth/pages/`                           |
| Tableau de bord administrateur  | `features/admin/pages/tableau-de-bord/`          |
| Tableau de bord diététicien     | `features/dieteticien/pages/tableau-de-bord/`    |
| Suivi et graphiques diététiques | `features/dieteticien/pages/suivi/`              |
| Tableau de bord nutritionniste  | `features/nutritionniste/pages/tableau-de-bord/` |

Dans chaque dossier métier, le fichier `.ts` contient le composant et ses données fictives, le `.html` décrit l’écran et le `.css` règle sa présentation. Les styles communs aux tableaux de bord sont dans `shared/components/dashboard.css`.

## Éléments partagés

- `shared/components/workspace-layout.component.*` : barre latérale et cadre de page. Barre sombre pour l’admin, claire pour les professionnels. Largeur bureau : 280 px ; menu escamotable sur petit écran.
- `shared/components/workspace-config.ts` : noms et liens de navigation des trois acteurs.
- `shared/components/ui-icon.component.ts` : petites icônes SVG locales.
- `shared/components/charts/` : histogramme des inscriptions et anneau de répartition, réalisés en SVG avec une description accessible.
- `shared/components/appointments.component.ts` : liste des rendez-vous réutilisée par les deux professionnels.
- `shared/components/workspace-page.component.*` : listes de démonstration pour les autres rubriques, recherche et aperçu d’un dossier. Ces rubriques ne sont pas encore des formulaires métier complets.
- `app.routes.ts` : navigation. Exemple : `/espaces/admin/tableau-de-bord`.
- `src/styles.css` : couleurs et polices globales.
- `src/material-theme.scss` : thème Material personnalisé, couleurs exactes, Poppins, arrondis des cartes, champs et boutons. Il s’applique aussi aux fenêtres et menus superposés.
- `core/material-french.ts` : libellés de pagination en français.
- `core/demo-notes.service.ts` : notes personnelles de démonstration conservées en mémoire, séparées par acteur, rubrique et fiche.
- `shared/components/record-detail-dialog.component.ts` : fiche dans une fenêtre Material avec note personnelle (500 caractères maximum), fermeture et enregistrement local.

## Références et limites

Les tableaux de bord ont été rapprochés des frames Figma `admin-vue-ensemble`, `diet-dashboard-overview`, `dashboard-overview` et `diet-dashboard-user-tracking`, sur une base bureau 1440 × 1024.

Le logo est provisoire et les avatars utilisent des initiales : les fichiers d’origine ne sont pas disponibles localement. Les dates, personnes et chiffres sont des exemples de maquette. Les valeurs de l’histogramme sont illustratives. Les parts de l’anneau sont calculées à partir de 1 247 parents et 38 professionnels, soit environ 97 % / 3 % ; certaines proportions dessinées dans Figma ne concordaient pas avec ces légendes.

Les données sont locales, sans API ni authentification serveur. Les notes survivent aux changements de rubrique et d’acteur pendant la session, mais disparaissent au rechargement de la page. Les routes chargent les pages à la demande pour limiter le poids initial. Les guards de navigation ne remplacent pas la sécurité côté serveur. `core/` et les dossiers `data-access/` sont réservés aux futurs branchements. Les anciens dossiers `layouts/` ne portent pas la navigation active : celle-ci est dans `workspace-layout`.

## Démarrer

```bash
npm start
```

Ouvrir `http://localhost:4200/espaces` puis choisir un rôle. Pour compiler : `npm run build`.

## Parcours interactifs du prototype

1. Choisir un des trois acteurs depuis `/espaces`.
2. Ouvrir une rubrique de liste (par exemple Utilisateurs pour l’admin).
3. Rechercher un nom, puis ouvrir **Consulter**.
4. Ajouter une note et utiliser **Enregistrer la note** : une confirmation Material s’affiche.
5. Revenir à la fiche pour retrouver la note pendant la session.
6. Utiliser **Changer d’espace** pour naviguer entre les trois acteurs.

Les boutons d’adaptation et les questions mènent encore à des listes d’aperçu : les formulaires métier complets et l’envoi aux patients restent à implémenter avec les règles fonctionnelles et l’API.
