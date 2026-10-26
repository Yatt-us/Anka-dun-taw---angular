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

Vérification de compilation de cette évolution : `npm run build`.

## À faire lors de l’évolution

Déplacer progressivement chaque rubrique métier dans `pages/<rubrique>/`, et son accès API dans `data-access/`. Conserver dans `shared/` seulement les éléments réutilisables sans règles spécifiques au diététicien.
