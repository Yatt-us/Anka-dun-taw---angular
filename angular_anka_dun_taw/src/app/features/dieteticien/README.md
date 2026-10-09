# Fonctionnalité Diététicien(ne)

## Implémenté

- Tableau de bord : `pages/tableau-de-bord/` et `data-access/`.
- Suivi des patients : `pages/suivi/` et accès aux données associé.
- Demandes d’adaptation : `pages/adaptations/`.
- Portions et coûts : `pages/portions-couts/`.
- Les listes, données et actions propres au diététicien sont dans `data-access/dieteticien-workspace.data-access.ts`.
- Les autres rubriques configurées dans `shared/components/workspace-config.ts` utilisent encore le tableau générique `shared/components/workspace-page.component.*`.

## À faire lors de l’évolution

Déplacer progressivement chaque rubrique métier dans `pages/<rubrique>/`, et son accès API dans `data-access/`. Conserver dans `shared/` seulement les éléments réutilisables sans règles spécifiques au diététicien.
