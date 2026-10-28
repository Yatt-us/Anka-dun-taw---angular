# Fonctionnalité Nutritionniste

## Implémenté

- Le tableau de bord et ses données sont dans `pages/tableau-de-bord/` et `data-access/`.
- Les listes, données et actions propres au nutritionniste sont dans `data-access/nutritionniste-workspace.data-access.ts`.
- Les autres rubriques nutritionniste configurées dans `shared/components/workspace-config.ts` utilisent encore le tableau générique `shared/components/workspace-page.component.*`.
- Les fiches nutritionnistes s’appuient sur les bénéficiaires liés à des rendez-vous acceptés ou terminés. Depuis une fiche, « Écrire au patient » ouvre la conversation existante ; si aucune conversation n’existe, l’écran explique que le patient doit d’abord envoyer le premier message.
- L’ouverture d’une conversation marque les messages reçus comme lus côté API ; le compteur non lu est remis à jour dans la liste. Le placement des bulles utilise l’identifiant d’auteur renvoyé par l’API, et les messages du professionnel affichent leur date ainsi que l’état « Envoyé » ou « Lu ».

## À faire lors de l’évolution

Déplacer progressivement chaque rubrique métier dans `pages/<rubrique>/`, et son accès API dans `data-access/`. Conserver dans `shared/` seulement les éléments réutilisables sans règles propres au nutritionniste.
