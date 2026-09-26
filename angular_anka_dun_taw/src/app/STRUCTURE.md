# Organisation de l’application

Cette application Angular est organisée par fonctionnalité.

- `core/` : services singleton, authentification, guards et interceptors globaux.
- `shared/` : composants, directives, pipes et utilitaires réutilisés.
- `layouts/` : cadres de navigation des utilisateurs, professionnels et administrateurs.
- `features/` : pages et logique métier regroupées par domaine. Chaque feature contient `pages/`, `components/`, `data-access/`, `models/` et `routes/`.

Les dossiers sont préparés pour accueillir les composants standalone et le chargement différé via le routeur Angular. Les routes globales restent dans `app.routes.ts`.
