# Fonctionnalité Administration

## Implémenté

- Le tableau de bord et ses données sont dans `pages/tableau-de-bord/` et `data-access/`.
- Les listes utilisateurs/professionnels, leur fiche détaillée, la validation et la gestion des rôles sont dans `pages/gestion-personnes/` et `data-access/admin-people.data-access.ts`.
- Les aliments locaux et leurs prix sont dans `pages/aliments/` et `data-access/admin-foods.data-access.ts`. Leur création utilise le formulaire partagé `shared/forms/workspace-editor.component.*`.
- Les quiz et défis sont dans `pages/contenus/` et `data-access/admin-content.data-access.ts`. L'administrateur peut supprimer un quiz tant qu'il est en brouillon ; l'interface demande une confirmation et le backend refuse la suppression après publication.
- Les autres listes et actions admin sont dans `data-access/admin-workspace.data-access.ts`.
- La liste des rubriques admin est définie dans `shared/components/workspace-config.ts`.
- Les autres rubriques utilisent encore la table générique `shared/components/workspace-page.component.*`.
- Le menu latéral fixe et son affichage des rubriques secondaires sont définis dans `shared/components/workspace-layout.component.*` et `workspace-admin-layout.component.css`.

## À faire lors de l’évolution

Déplacer chaque rubrique admin vers `pages/<rubrique>/` et les requêtes correspondantes vers `data-access/`. Ne pas créer de composants vides pour les pages futures. Mettre à jour les routes et la navigation après chaque migration.
