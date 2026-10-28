# Anka Dùn Taw — interfaces web de gestion

Ce projet Angular contient les espaces **administrateur**, **diététicien** et **nutritionniste**. Il consomme l’API Spring Boot Anka Dùn Taw. L’application mobile destinée au grand public se trouve dans un autre projet.

## Démarrer les deux applications

Prévoir Node.js 24, npm 11 et le JDK utilisé par le backend. La base de données, le secret JWT et le compte administrateur se configurent **dans le backend**, jamais dans ce projet Angular.

1. Dans un premier terminal, à la racine du backend :

   ```bash
   ./mvnw spring-boot:run
   ```

   Le profil de développement du backend charge sa configuration locale et démarre normalement sur `http://localhost:8080`.

2. Dans un second terminal, à la racine de ce projet Angular :

   ```bash
   npm ci
   npm start
   ```

3. Ouvrir [http://localhost:4200/connexion](http://localhost:4200/connexion), puis saisir **l’e-mail ou le téléphone** et le mot de passe d’un compte administrateur ou professionnel enregistré dans le backend.

Le fichier `src/proxy.conf.json` relaie les requêtes `/api/**` vers `http://localhost:8080` pendant `npm start`. Le navigateur reste sur l’origine `localhost:4200`, ce qui permet au cookie de renouvellement `HttpOnly` de fonctionner. Il n’y a aucune clé JWT ni aucun mot de passe à placer dans Angular.

### En production

Les appels Angular utilisent le chemin relatif `/api/v1`. Sur Vercel, le fichier [`vercel.json`](vercel.json) relaie `/api/**` vers le backend Render et conserve la navigation Angular sur `index.html`. Configurer la racine du projet Vercel sur `angular_anka_dun_taw`, là où se trouvent `package.json` et `vercel.json`. Le proxy Angular `src/proxy.conf.json` ne s’applique qu’au serveur de développement. Le backend doit être lancé avec son profil `prod` et ses variables d’environnement ; voir son README pour ces réglages.

Après le déploiement, ouvrir `https://<site-vercel>/api/v1/auth/google/configuration` : la réponse doit être du JSON. Si elle contient `<!doctype html>`, la règle de relais Vercel n’est pas active et l’application sert sa page d’accueil à la place de l’API. La session doit ensuite pouvoir être restaurée après un rechargement de la page grâce au cookie de renouvellement émis sur la même origine.

Au-delà de 8 secondes d'attente sur la connexion, l'écran explique que le serveur peut être en cours de démarrage. Cela n'interrompt pas la requête ; sur l'instance Render gratuite, un réveil observé le 13 octobre 2026 a duré 225 secondes. Ce message ne réduit pas le temps de démarrage du service.

## Connexion et droits

- `POST /api/v1/auth/connexion` reçoit l’identifiant et le mot de passe. Pour un téléphone, Angular affiche l’indicatif fixe `+223` et convertit les huit chiffres saisis au format international avant l’envoi. Le JWT d’accès reste en mémoire dans Angular.
- Le backend place le jeton de renouvellement dans le cookie `anka_refresh`, inaccessible au JavaScript. Au rechargement, Angular appelle `POST /api/v1/auth/rafraichir` pour restaurer la session.
- L’intercepteur ajoute `Authorization: Bearer …` aux appels API et tente une fois le renouvellement après un `401`.
- `POST /api/v1/auth/deconnexion` révoque la session côté serveur. L’interface ne signale une déconnexion réussie qu’après confirmation du serveur.
- Si un identifiant client OAuth **Web** valide est configuré dans le backend, `GET /api/v1/auth/google/configuration` active le bouton Google. Le navigateur remet le jeton Google à `POST /api/v1/auth/google/connexion`, puis utilise la même session JWT et le même cookie de renouvellement. Un compte existant doit d’abord être lié depuis « Sécurité du compte » avec `POST /api/v1/auth/google/lier` après connexion locale ; une simple correspondance d’e-mail ne suffit pas. Un nouveau compte Google reçoit le rôle `UTILISATEUR` et n’ouvre donc aucun espace de gestion web.
- Depuis `/compte`, un professionnel peut s’inscrire (`POST /auth/inscription-professionnel`), demander un lien de récupération (`POST /auth/mot-de-passe/oublie`) et réinitialiser son mot de passe (`POST /auth/mot-de-passe/reinitialiser`). Le lien est valable 10 minutes ; son jeton placé dans `?jeton=` est repris automatiquement par l’écran.
- Dans « Paramètres » ou « Mon profil », `POST /auth/mot-de-passe/changer` modifie le mot de passe après vérification de l’actuel, confirmation de la nouvelle saisie et contrôle de différence. La session est ensuite révoquée et l’utilisateur revient à la connexion.
- Les champs de mot de passe des écrans d’authentification et de sécurité ont un bouton afficher/masquer. Les codes de vérification d’e-mail expirent eux aussi après 10 minutes.
- Les routes Angular n’ouvrent que l’espace correspondant au rôle `ADMIN`, `DIETETICIEN` ou `NUTRITIONNISTE`. Les espaces professionnels exigent aussi un profil vérifié. Le backend reste responsable de l’autorisation de chaque requête.
- Un compte `UTILISATEUR` n’a pas d’espace dans cette application web : il relève du projet mobile.

Si un professionnel est encore en attente, refusé ou suspendu, l’écran d’espace affiche son état et bloque l’ouverture de ses pages.

## Écrans reliés au backend

| Espace | Écran | Sources principales |
| --- | --- | --- |
| Administrateur | Tableau de bord | `/admin/statistiques`, `/admin/rapports/activite`, `/admin/journal-activite` |
| Administrateur | Utilisateurs, professionnels | `/admin/comptes`, `/admin/professionnels` |
| Administrateur | Aliments, catégories, recettes | `/aliments`, `/categories-aliments`, `/admin/recettes` |
| Administrateur | Contenus publiés, historique | `/conseils` en lecture seule, `/articles`, `/quiz`, `/admin/journal-activite` |
| Administrateur | Quiz, défis, badges | `/admin/quiz`, `/admin/defis`, `/badges` et routes d’écriture `/admin/quiz`, `/admin/defis`, `/admin/badges` |
| Administrateur | Liste et archivage des menus | `/admin/menus`, `/admin/menus/{id}/archiver` |
| Diététicien | Tableau de bord | `/professionnel/menus`, demandes d’adaptation de chaque menu, `/professionnel/rendez-vous` |
| Diététicien | Menus, adaptations, patients, rendez-vous, disponibilités, messagerie, profil | `/professionnel/menus`, `/professionnel/beneficiaires/{id}/…`, `/professionnel/rendez-vous`, `/professionnel/disponibilites`, `/professionnel/messagerie/conversations`, `/professionnels/me` |
| Nutritionniste | Tableau de bord | Conversations, rendez-vous, articles et conseils rédigés |
| Nutritionniste | Conseils et articles, conversations, rendez-vous, disponibilités, profil | `/conseils/mes-conseils`, `/articles/mes-articles`, `/professionnel/messagerie/conversations`, `/professionnel/rendez-vous`, `/professionnel/disponibilites`, `/professionnels/me` |
| Trois rôles | Notifications | `/me/notifications`, `/me/notifications/{id}/lire` |

Toutes ces routes sont préfixées par `/api/v1`. La recherche filtre uniquement la page affichée ; la pagination lit les pages du serveur. Un chargement, une erreur, une liste vide et une rubrique indisponible sont présentés séparément. Aucune valeur fictive n’est utilisée pour les tableaux de bord en service.

Les professionnels disposent de `GET /professionnel/beneficiaires`, une liste paginée des utilisateurs actifs liés par un rendez-vous accepté ou terminé. Le diététicien peut consulter le profil nutritionnel, les objectifs et les budgets d’un bénéficiaire autorisé. Les consultations du nutritionniste affichent les rendez-vous demandés et ses questions affichent les conversations. La rubrique « Portions & coûts » compose les données des menus et budgets existants.

## Formulaires et actions disponibles

| Espace | Saisie | Autres actions |
| --- | --- | --- |
| Administrateur | Créer des catégories, aliments, recettes, quiz, défis et badges ; modifier une catégorie, un aliment ou une recette brouillon ; ajouter un prix par zone | Vérifier/refuser un professionnel, changer le rôle ou désactiver un utilisateur, publier/archiver une recette, publier/archiver quiz et défis, attribuer un badge, enregistrer une progression de défi, consulter les prix locaux et archiver un menu par numéro |
| Diététicien | Créer/modifier un menu avec bénéficiaires et repas, adapter un menu à la demande d’un patient, gérer ses créneaux, modifier son profil, répondre aux messages | Valider/publier un menu, accepter/refuser/terminer un rendez-vous, consulter les données nutritionnelles autorisées |
| Nutritionniste | Rédiger/modifier un conseil ou un article brouillon, gérer ses créneaux, modifier son profil, répondre aux messages | Valider/publier/archiver un conseil, publier/archiver un article, accepter/refuser/terminer un rendez-vous |

Les formulaires transmettent les champs attendus par les DTO Spring Boot. Les listes d’aliments, catégories et recettes alimentent les sélecteurs, tandis que les numéros des bénéficiaires du menu sont à renseigner depuis les dossiers connus du professionnel. Le formulaire d'aliment signale les champs invalides, propose de recharger les catégories et accepte une image HTTPS ou un chemin local produit par le téléversement. Les actions affichent le message d’erreur du backend et actualisent la liste après succès. Une réponse refusant un rendez-vous peut contenir un commentaire.

Les montants sont affichés en **FCFA** dans les écrans et les exports destinés aux utilisateurs. L'API et les comparaisons de devises continuent d'utiliser le code ISO `XOF` : remplacer ce code dans une requête provoquerait un refus du backend. Le formulaire d'aliment ne transmet pas `disponible` ; ce statut est modifié uniquement par les actions dédiées Désactiver/Réactiver.

Le formulaire de menu exige au moins un bénéficiaire et un repas. Une recette exige au moins un ingrédient. Une adaptation acceptée soumet un **menu révisé complet** avec le demandeur comme bénéficiaire ; une demande refusée reçoit une réponse. Le conseil reste au statut `BROUILLON` après sa validation dans le backend ; la liste l’affiche « Validé » grâce à `validateurId`, afin de rendre ensuite l’action « Publier » disponible.

Les listes administratives de quiz, défis et menus affichent aussi les brouillons et proposent un filtre de statut. Un brouillon de quiz ou de défi peut être rouvert et modifié. Un quiz en brouillon peut aussi être supprimé après confirmation ; l'API refuse la suppression d'un quiz publié ou archivé. Les réponses correctes d’un quiz ne sont renvoyées que par l’API administrative protégée. Un menu publié peut être archivé depuis sa liste. Les routes `/me/**` réservées à `UTILISATEUR` appartiennent à Flutter, sauf les notifications autorisées à tout compte connecté.

Le menu latéral administrateur reste fixe pendant que le contenu défile. Son en-tête crème porte le logo ; le rail marine possède un liseré bleu et une découpe blanche arrondie en haut à droite, prolongée par l'onglet actif. Les neuf rubriques principales restent visibles. « Autres rubriques » est fermé par défaut : un clic affiche les liens Menus personnalisés, Quiz, Défis et Badges, et un second clic les masque. Sur les écrans courts, seule la liste des rubriques défile : l'en-tête, l'espace au-dessus des liens et le profil restent fixes, y compris dans le volet mobile. Les courriels de rendez-vous et de vérification professionnelle sont envoyés par le backend après l'action ; Angular n'envoie aucun message directement. Leur activation SMTP est décrite dans le README du backend.

Dans les espaces **diététicien** et **nutritionniste**, le rail latéral est compact par défaut : seul l'onglet courant affiche son libellé. Le bouton en haut du rail dévoile les noms de toutes les rubriques ; un second clic le referme. Les liens conservent leur destination et leur titre accessible dans les deux états. Sur téléphone, le menu reste un tiroir ouvert depuis l'en-tête, avec un bouton de fermeture à l'intérieur et une fermeture par clic hors du tiroir.

La commande **Déconnexion** est maintenant visible en bas du rail professionnel : icône avec libellé accessible quand il est compact, icône et texte quand il est ouvert, puis bouton complet dans le tiroir mobile. Une erreur de déconnexion ouvre le rail afin de rendre son message lisible. Les textes courants des cartes, tableaux et formulaires des deux espaces ont été légèrement agrandis ; les réglages typographiques sont limités à ces espaces et ne changent pas l'administration.

Le profil professionnel permet de renseigner un tarif de consultation facultatif, exprimé en FCFA, et de vérifier ou changer l'adresse e-mail avec un code reçu par SMTP. Les courriels de rendez-vous et de validation ne partent qu'après confirmation de l'adresse. Le diététicien voit séparément le nombre de personnes, le budget familial hebdomadaire et les contraintes d'une demande d'adaptation. Ces champs nécessitent les migrations backend 029 à 031 ; le paiement en ligne n'est pas implémenté.

L'onglet administrateur « Conseils pratiques » présente seulement les conseils publiés. Leur création, modification et archivage sont réservés par le backend au nutritionniste auteur ; l'administration n'affiche donc aucune commande d'écriture pour ces contenus.

### Activer « Continuer avec Google »

Le flux Angular et ses endpoints backend sont présents : Angular affiche le bouton si la configuration backend est valide, transmet le jeton d’identité Google au backend, puis utilise la session JWT habituelle. Le backend vérifie ce jeton avec le client OAuth configuré. Le bouton et la liaison de compte sont dans `features/auth/`.

1. Dans Google Cloud Console, configure l’écran de consentement puis crée un identifiant client OAuth de type **Application Web**. Google documente ces étapes dans son [guide de configuration Google Identity Services](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
2. Ajoute les origines JavaScript autorisées : `http://localhost:4200` pour le développement et l’origine HTTPS réelle du site en production. L’identifiant client Web est public; ne mets jamais de clé privée dans Angular.
3. Dans l’environnement du backend Spring Boot, renseigne `ANKA_GOOGLE_CLIENT_ID` avec l’identifiant client Web puis redémarre le serveur. Ne le mets pas dans un fichier Angular.
4. Vérifie la configuration avec `GET http://localhost:8080/api/v1/auth/google/configuration`. Elle doit renvoyer `{"disponible":true,"clientId":"…apps.googleusercontent.com"}`. Avec `disponible:false`, le bouton reste masqué et l’interface explique que Google n’est pas configuré.
5. Lance Angular avec `npm start`. Clique sur Google : la réponse Google est envoyée à `POST /api/v1/auth/google/connexion`. Les comptes professionnels déjà créés doivent d’abord associer Google depuis « Sécurité du compte »; Google ne fusionne pas deux comptes par simple correspondance d’adresse e-mail.

Si le front Angular et l’API sont servis sur des origines différentes en production, configure aussi l’origine du site dans `ANKA_CORS_ORIGINS` côté backend. En développement, `src/proxy.conf.json` relaie `/api` vers le serveur Spring Boot.

## Organisation du code

```text
src/
├── proxy.conf.json                         Relais API pour ng serve
├── material-theme.scss                     Thème Angular Material
├── styles.css                              Couleurs et police
└── app/
    ├── app.config.ts                       HttpClient, intercepteur et routes
    ├── app.routes.ts                       Connexion et espaces protégés
    ├── core/
    │   ├── auth/                            Session JWT et modèles
    │   ├── config/api.config.ts             Préfixe /api/v1
    │   ├── guards/actor-workspace.guard.ts  Accès selon rôle et vérification
    │   └── interceptors/auth.interceptor.ts En-tête Bearer et renouvellement
    ├── features/
    │   ├── auth/                            Connexion, gestion du compte, sécurité et Google
    │   ├── admin/                           Tableau de bord et accès API admin
    │   ├── dieteticien/                     Tableau de bord, suivi et adaptations
    │   ├── nutritionniste/                  Tableau de bord et accès API nutritionniste
    │   └── professionnel/                   Patients et disponibilités partagés
    └── shared/
        ├── data-access/                     Listes utilisées par plusieurs rôles
        ├── forms/                            Formulaire réutilisé entre fonctionnalités
        └── components/                       Navigation et cadre commun des espaces
```

Les services propres aux tableaux de bord sont rangés dans `features/<role>/data-access/`. `WorkspaceListService` et le formulaire générique restent dans `shared/` parce qu’ils desservent plusieurs rôles. La structure détaillée et les responsabilités sont décrites dans [STRUCTURE.md](src/app/STRUCTURE.md). Les dossiers de fonctionnalités sans code n’ont pas de placeholders : ils seront créés avec leurs premiers vrais écrans.

## Design system

Le thème et les variables CSS reprennent le design system du projet Figma : bleu océan `#006AA4` pour les boutons d’action principaux des espaces utilisateur, professionnel et administrateur ; vert `#2E7D5B` pour les états positifs ; jaune `#F4B942`, orange `#E8894A`, rouge `#D9534F`, texte `#26332D` et fond clair `#FFF9F0`. Les actions de désactivation ou de suppression restent rouges. La police Poppins est chargée localement depuis `public/fonts/`. Les espaces gardent la mise en page prévue pour **1440 × 1024 px**, avec une barre latérale de 280 px sur grand écran.

Les transitions d’écran utilisent les API Angular natives `animate.enter` et `animate.leave`, avec des keyframes CSS définis dans `src/styles.css`. L’admin a une apparition verticale, le diététicien un léger déplacement horizontal et le nutritionniste un fondu avec agrandissement discret. Les panneaux et messages de confirmation ont aussi une entrée et une sortie animées. `prefers-reduced-motion` réduit ces animations au minimum. Aucune dépendance d’animation externe n’est ajoutée : Angular 22 fournit ces API, et le paquet historique `@angular/animations` est déprécié.

## Compilation et limites

```bash
npm run build
```

Une compilation Angular de production vérifie la cohérence du code front, mais ne prouve pas que le backend, PostgreSQL et les comptes sont disponibles à l’exécution.

Cette liaison couvre les parcours web décrits ci-dessus pour les trois rôles. La compilation ne remplace pas une vérification de bout en bout avec Spring Boot, PostgreSQL et des comptes réels.

## Prix régionaux dans l'administration

Dans **Aliments locaux → Prix et saisonnalité**, le sélecteur de région détermine le prix présenté et exporté pour chaque aliment. Le sélecteur et les formulaires de prix/menu chargent leurs choix depuis `GET /api/v1/zones`, qui renvoie les 19 régions du Mali et le district de Bamako. La table charge les relevés de la page en un appel à `GET /api/v1/aliments/prix-actuels?zone=…&ids=…` et n'affiche que le plus récent dont la période inclut aujourd'hui dans cette région ; `—` signifie qu'aucun prix actuel n'y est disponible. Une erreur de chargement est affichée séparément et désactive l'export des prix. Le formulaire d'ajout de prix envoie toujours la région choisie pour le relevé. Le backend refuse les périodes qui se chevauchent pour un même aliment, une même région et une même unité (HTTP 409). Le détail de l'aliment conserve la liste de tous ses relevés.

Les vues professionnelles qui ouvrent un menu par son identifiant nécessitent `GET /api/v1/professionnel/menus/{id}` sur le backend correspondant.

Dans **Diététicien → Créer un menu**, le patient sélectionné charge uniquement son profil nutritionnel actif, sa région et ses budgets liés à ce profil. Le budget actif affiché correspond strictement à `budgetActifId` ; aucun autre budget de la liste n'est pris par défaut. Les repas sont regroupés par jour, semaine ou mois selon la période du budget. En mode petit budget, les montants disponibles sont lus pour chaque date de repas via `GET /api/v1/professionnel/beneficiaires/{id}/petit-budget/jours/{date}`. L'interface indique les dépassements estimés et bloque une publication si un montant journalier manque ou si les repas saisis dépassent le budget connu. Le backend vérifie également les autres menus publiés et refuse la validation si le patient a changé de profil actif depuis la création du brouillon.

Dans **Menus publiés**, le détail d'un menu affiche aussi ses versions conservées par `GET /api/v1/professionnel/menus/{id}/versions`. Ouvrir une version montre le titre, le statut, les bénéficiaires et les repas enregistrés à cette date, y compris les portions et coûts. Le chargement et les erreurs de cet historique sont indépendants du détail courant. Cette vue nécessite le backend et la migration `028_versions_menus` correspondants ; les versions plus anciennes que la migration ne peuvent pas être reconstituées.


Dans l’espace administrateur, **Historique** présente les événements avec un libellé d’action en français, le type d’objet, sa référence, la date et le nom de l’acteur. L’écran n’affiche pas la description technique contenant les verbes ou routes HTTP ; les anciennes lignes déjà enregistrées suivent le même affichage.
