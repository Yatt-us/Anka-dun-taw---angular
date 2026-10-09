# Structure Angular actuelle

L’application utilise Angular standalone et une organisation par fonctionnalité. Cette page décrit l’état réel du code, y compris les écrans encore mutualisés dans l’espace de travail.

```text
src/app/
├── core/
│   ├── auth/                 Modèles et session JWT
│   ├── config/               Configuration de l’URL API
│   ├── guards/               Session, rôle, validation professionnelle et rubrique
│   ├── interceptors/         Ajout du jeton aux requêtes HTTP
│   └── material-french.ts    Libellés français Angular Material
├── features/
│   ├── admin/
│   │   ├── data-access/      Listes/actions admin, tableau de bord et comptes
│   │   └── pages/            Tableaux de bord et gestion des utilisateurs/professionnels
│   ├── auth/
│   │   ├── components/       Bouton de connexion Google
│   │   └── pages/            Connexion, sélection d’espace, compte et sécurité
│   ├── dieteticien/
│   │   ├── data-access/      Listes/actions du diététicien et tableaux de bord
│   │   └── pages/            Tableau de bord, suivi, adaptations, portions et coûts
│   ├── nutritionniste/
│   │   ├── data-access/      Listes/actions du nutritionniste et tableau de bord
│   │   └── pages/tableau-de-bord/
│   └── professionnel/
│       ├── data-access/      Échanges et messages professionnels
│       ├── disponibilites/   Gestion des disponibilités
│       └── patients/         Écran patient partagé
└── shared/
    ├── components/           Cadre, navigation, tableaux de bord et page d’espace
    ├── data-access/          Adaptateur de routage et notifications communes
    └── forms/                Éditeur générique et configuration de formulaires
```

## Fonctionnement des espaces

- `app.routes.ts` déclare les routes et charge les composants à la demande.
- `actorWorkspaceGuard` vérifie la session, le rôle correspondant à l’espace et, pour les professionnels, le statut de vérification.
- `workspaceSectionGuard` refuse une rubrique absente de la navigation de l’acteur connecté.
- `workspace-config.ts` est la source des rubriques et libellés par acteur.
- Les tableaux de bord spécialisés se trouvent dans leurs fonctionnalités respectives.
- Les pages de gestion génériques sont rendues par `shared/components/workspace-page.component.*`; les tableaux de bord, gestion des personnes, suivi, adaptations, portions/coûts, patients, disponibilités et paramètres ont des routes dédiées.
- `shared/data-access/workspace-list.service.ts` choisit le service de fonctionnalité; les requêtes métier et le mapping des lignes sont dans `features/<acteur>/data-access/`.
- Les messages et réponses relèvent de `features/professionnel/data-access/`; les notifications communes sont dans `shared/data-access/`.
- Les formulaires de création/édition partagés restent dans `shared/forms/`.

## Répartition entre fonctionnalités et composants partagés

`WorkspacePageComponent` reste un tableau/formulaire générique réutilisé pour les rubriques qui ont la même interaction de gestion. Il ne décide plus selon le rôle quelles actions ou quels champs afficher : chaque data-access de fonctionnalité fournit les capacités de détail de ses lignes (`editKind`, prix, progression, commentaires ou messagerie). Le formulaire et le rendu générique consomment ces capacités.

`WorkspaceListService` est l’adaptateur de routage : il transmet les demandes au data-access du rôle et regroupe les services réellement communs, comme les notifications et la messagerie. Les règles d’API, les mappings et les actions métier restent dans `features/<acteur>/data-access/`. Les écrans avec un parcours différent (validation des personnes, suivi, adaptations, portions/coûts, disponibilités et patients) ont leurs composants dédiés.

Une rubrique pourra recevoir un composant dédié si son parcours UX devient différent du tableau commun; ce n’est plus nécessaire pour séparer ses règles métier, qui résident déjà dans sa fonctionnalité.

Les espaces web concernent l’administration et les professionnels. L’espace grand public reste dans le projet Flutter.
