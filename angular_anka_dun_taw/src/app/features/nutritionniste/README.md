# Fonctionnalité Nutritionniste

## Implémenté

- Le tableau de bord et ses données sont dans `pages/tableau-de-bord/` et `data-access/`.
- Les listes, données et actions propres au nutritionniste sont dans `data-access/nutritionniste-workspace.data-access.ts`.
- Les autres rubriques nutritionniste configurées dans `shared/components/workspace-config.ts` utilisent encore le tableau générique `shared/components/workspace-page.component.*`.

## À faire lors de l’évolution

Déplacer progressivement chaque rubrique métier dans `pages/<rubrique>/`, et son accès API dans `data-access/`. Conserver dans `shared/` seulement les éléments réutilisables sans règles propres au nutritionniste.
