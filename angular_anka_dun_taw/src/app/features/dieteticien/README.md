# Fonctionnalité Diététicien(ne)

## Implémenté

- Tableau de bord : `pages/tableau-de-bord/` et `data-access/`.
- Suivi des patients : `pages/suivi/` et accès aux données associé.
- Demandes d’adaptation : `pages/adaptations/`.
- Portions et coûts : `pages/portions-couts/`.
- Les listes, données et actions propres au diététicien sont dans `data-access/dieteticien-workspace.data-access.ts`.
- Les autres rubriques configurées dans `shared/components/workspace-config.ts` utilisent encore le tableau générique `shared/components/workspace-page.component.*`.

## Création et publication d’un menu personnalisé

`pages/creer-menu/` enregistre le menu avant de lancer les étapes de validation et de publication côté API. Si une de ces étapes échoue, le brouillon reste conservé et le message précise maintenant l’étape, puis affiche le motif détaillé renvoyé par le backend. Pour les profils « Avec budget » ou « Petit budget », la publication est bloquée en amont lorsqu’un budget actif ou un coût vérifiable manque. Les règles métier finales (saison, allergies, prix, budget et accès du professionnel) restent contrôlées par le backend.

### Parcours de création d’un menu

1. Choisir un patient lié au compte du professionnel. L’écran charge son profil nutritionnel actif, sa région et son budget.
2. Indiquer le titre et la période, puis composer le menu en ajoutant une recette par repas. Le numéro du jour est relatif à la date de début : le jour 1 correspond à cette date.
3. Lire l’estimation des coûts pour la région et les dates choisies, puis vérifier les contraintes du budget. Les prix manquants ou un dépassement peuvent bloquer la publication.
4. « Publier maintenant » enregistre le menu, demande au backend de le valider, puis de le publier en une action. « Garder en brouillon » le conserve privé ; le lien « Ouvrir la validation des menus » conduit à la revue, à la correction éventuelle et à la publication différée.

Le contrôle automatique ne remplace pas la vérification professionnelle des allergènes et de l’adéquation nutritionnelle. Une erreur après création laisse le brouillon disponible et indique si l’enregistrement, la validation ou la publication a échoué.

La route de création est déclarée en deux segments (`menus` puis `creer`). Les chemins du menu latéral sont eux aussi séparés en segments Angular afin que `menus/creer` ne soit pas encodé en `menus%2Fcreer`. Le garde de section lit la rubrique complète dans les données de route et retrouve l’espace professionnel dans toute la chaîne de routes.

Dans `dieteticien-create-menu.component.ts`, `saveValidationError()` regroupe les contrôles du formulaire avant l'enregistrement. Les règles et les messages restent identiques ; `save()` conserve l'ordre enregistrement, validation, publication.

`data-access/dieteticien-menu.data-access.ts` centralise les appels HTTP et la pagination de cet écran. Le composant conserve l'état, les calculs de présentation et l'enchaînement enregistrement → validation → publication. Les routes et les réponses API ne changent pas.

Vérification de compilation de cette évolution : `npm run build`.

## À faire lors de l’évolution

Déplacer progressivement chaque rubrique métier dans `pages/<rubrique>/`, et son accès API dans `data-access/`. Conserver dans `shared/` seulement les éléments réutilisables sans règles spécifiques au diététicien.
