# Fonctionnalité Administration

## Implémenté

- Le tableau de bord et ses données sont dans `pages/tableau-de-bord/` et `data-access/`.
- Les listes utilisateurs/professionnels, leur fiche détaillée, la validation et la gestion des rôles sont dans `pages/gestion-personnes/` et `data-access/admin-people.data-access.ts`.
- Les aliments locaux et leurs prix sont dans `pages/aliments/` et `data-access/admin-foods.data-access.ts`. Leur création utilise le formulaire partagé `shared/forms/workspace-editor.component.*`.
- Les catégories actives et désactivées sont consultables depuis `pages/categories/`; les catégories désactivées sont chargées depuis l’endpoint protégé par rôle admin.
- Les recettes publiées peuvent être archivées depuis leur carte ou leur fiche, avec une confirmation avant l’appel à l’API.
- Les quiz et défis sont dans `pages/contenus/` et `data-access/admin-content.data-access.ts`. L'administrateur peut supprimer un quiz tant qu'il est en brouillon ; l'interface demande une confirmation et le backend refuse la suppression après publication.
- Les autres listes et actions admin sont dans `data-access/admin-workspace.data-access.ts`.
- La liste des rubriques admin est définie dans `shared/components/workspace-config.ts`.
- Les autres rubriques utilisent encore la table générique `shared/components/workspace-page.component.*`.
- La navigation latérale admin est définie dans `shared/components/workspace-layout.component.*` et `shared/components/workspace-admin-layout.component.css`. Le logo occupe l’en-tête crème, puis le rail marine présente un liseré bleu et une découpe blanche arrondie en haut à droite, comme sur la maquette `admin-vue-ensemble.png`. L’onglet actif rejoint visuellement cette découpe. Sur les écrans courts, seule la liste des rubriques défile ; l’en-tête et le profil restent fixes, sur ordinateur comme sur mobile.
- « Autres rubriques » est un bouton accessible avec `aria-expanded`. Ses liens (menus personnalisés, quiz, défis et badges) sont masqués au chargement, apparaissent au clic et se replient au second clic. Les routes des sous-menus ne changent pas ; le même comportement fonctionne dans le menu mobile.

## À faire lors de l’évolution

Déplacer chaque rubrique admin vers `pages/<rubrique>/` et les requêtes correspondantes vers `data-access/`. Ne pas créer de composants vides pour les pages futures. Mettre à jour les routes et la navigation après chaque migration.
