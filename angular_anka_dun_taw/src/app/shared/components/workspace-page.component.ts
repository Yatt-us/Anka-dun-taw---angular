import { DemoNotesService } from '../../core/demo-notes.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { frenchPaginator } from '../../core/material-french';
import { RecordDetailDialogComponent } from './record-detail-dialog.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map } from 'rxjs';
import { ACTORS, ActorId, isActorId } from './workspace-config';
import { DieteticienTrackingComponent } from '../../features/dieteticien/pages/suivi/dieteticien-tracking.component';
interface DemoRow {
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: string;
  value: string;
}

const SECTION_TITLES: Record<string, string> = {
  utilisateurs: 'Utilisateurs',
  professionnels: 'Professionnels',
  aliments: 'Aliments locaux',
  categories: 'Catégories alimentaires',
  recettes: 'Recettes',
  contenus: 'Contenus & quiz',
  historique: 'Historique des activités',
  parametres: 'Paramètres',
  patients: 'Mes patients',
  menus: 'Menus personnalisés',
  'demandes-adaptation': 'Demandes d’adaptation',
  'portions-couts': 'Portions & coûts',
  'suivi-utilisateurs': 'Suivi des patients',
  profil: 'Mon profil',
  consultations: 'Consultations',
  'rendez-vous': 'Rendez-vous',
  recommandations: 'Recommandations',
  questions: 'Questions reçues',
};

const DEMO_TABLES: Record<ActorId, Record<string, DemoRow[]>> = {
  admin: {
    utilisateurs: [
      {
        title: 'Aminata Diallo',
        subtitle: 'aminata.d@example.ml',
        value: 'Bamako · Compte utilisateur',
        badge: 'Actif',
        badgeTone: 'green',
      },
      {
        title: 'Fatoumata Diarra',
        subtitle: 'fatou.d@example.ml',
        value: 'Ségou · Compte utilisateur',
        badge: 'Actif',
        badgeTone: 'green',
      },
      {
        title: 'Ousmane Koné',
        subtitle: 'ousmane.k@example.ml',
        value: 'Sikasso · Compte utilisateur',
        badge: 'À vérifier',
        badgeTone: 'yellow',
      },
    ],
    professionnels: [
      {
        title: 'Fatou Sidibé',
        subtitle: 'Diététicienne · Bamako',
        value: 'Dossier professionnel',
        badge: 'Vérifié',
        badgeTone: 'green',
      },
      {
        title: 'Mamadou Traoré',
        subtitle: 'Nutritionniste · Ségou',
        value: 'Dossier professionnel',
        badge: 'À vérifier',
        badgeTone: 'orange',
      },
      {
        title: 'Aïssata Coulibaly',
        subtitle: 'Diététicienne · Sikasso',
        value: 'Dossier professionnel',
        badge: 'En attente',
        badgeTone: 'yellow',
      },
    ],
    aliments: [
      {
        title: 'Mil',
        subtitle: 'Céréales · Aliment local',
        value: '378 kcal / 100 g · Mali',
        badge: 'Disponible',
        badgeTone: 'green',
      },
      {
        title: 'Fonio',
        subtitle: 'Céréales · Aliment local',
        value: '340 kcal / 100 g · Mali',
        badge: 'Disponible',
        badgeTone: 'green',
      },
      {
        title: 'Gombo',
        subtitle: 'Légumes · Produit frais',
        value: '33 kcal / 100 g · Mali',
        badge: 'À vérifier',
        badgeTone: 'yellow',
      },
    ],
    categories: [
      {
        title: 'Céréales',
        subtitle: 'Mil, fonio, riz, sorgho',
        value: '24 aliments',
        badge: 'Visible',
        badgeTone: 'green',
      },
      {
        title: 'Légumineuses',
        subtitle: 'Niébé, haricot, arachide',
        value: '18 aliments',
        badge: 'Visible',
        badgeTone: 'green',
      },
      {
        title: 'Légumes',
        subtitle: 'Produits frais de saison',
        value: '32 aliments',
        badge: 'Visible',
        badgeTone: 'green',
      },
    ],
    recettes: [
      {
        title: 'Dégué au mil',
        subtitle: 'Céréales · Recette locale',
        value: 'Préparation : 35 min',
        badge: 'Publiée',
        badgeTone: 'green',
      },
      {
        title: 'Riz au gras aux légumes',
        subtitle: 'Plat principal · Bamako',
        value: 'Préparation : 50 min',
        badge: 'Publiée',
        badgeTone: 'green',
      },
      {
        title: 'Bouillie de fonio',
        subtitle: 'Petit déjeuner · Famille',
        value: 'Préparation : 20 min',
        badge: 'À valider',
        badgeTone: 'orange',
      },
    ],
    contenus: [
      {
        title: 'Bien composer son petit déjeuner',
        subtitle: 'Conseil pratique',
        value: 'Conseils nutrition',
        badge: 'Publié',
        badgeTone: 'green',
      },
      {
        title: 'Quiz : les aliments riches en fer',
        subtitle: 'Quiz nutritionnel · 8 questions',
        value: 'Éducation nutritionnelle',
        badge: 'Brouillon',
        badgeTone: 'yellow',
      },
      {
        title: 'Défi : boire plus d’eau',
        subtitle: 'Défi de la semaine',
        value: 'Habitudes santé',
        badge: 'Publié',
        badgeTone: 'green',
      },
    ],
    historique: [
      {
        title: 'Validation d’un professionnel',
        subtitle: 'Par Aïssata Coulibaly',
        value: 'Gestion des comptes',
        badge: 'Terminé',
        badgeTone: 'green',
      },
      {
        title: 'Mise à jour du catalogue',
        subtitle: 'Catégorie Céréales',
        value: 'Aliments locaux',
        badge: 'Terminé',
        badgeTone: 'green',
      },
      {
        title: 'Publication d’un quiz',
        subtitle: 'Quiz nutritionnel',
        value: 'Contenus',
        badge: 'Terminé',
        badgeTone: 'green',
      },
    ],
    parametres: [
      {
        title: 'Profil administrateur',
        subtitle: 'Informations de compte',
        value: 'Aïssata Coulibaly',
        badge: 'Configuré',
        badgeTone: 'green',
      },
      {
        title: 'Gestion des rôles',
        subtitle: 'Droits des espaces',
        value: 'Administrateur · Professionnel',
        badge: 'Configuré',
        badgeTone: 'green',
      },
      {
        title: 'Préférences de notification',
        subtitle: 'Alertes administratives',
        value: 'Notifications activées',
        badge: 'Configuré',
        badgeTone: 'green',
      },
    ],
  },
  dieteticien: {
    'rendez-vous': [
      {
        title: 'Mariam Coulibaly',
        subtitle: 'Suivi grossesse',
        value: '23 octobre 2023 · 09h00',
        badge: 'Confirmé',
        badgeTone: 'green',
      },
      {
        title: 'Ibrahim Diarra',
        subtitle: 'Suivi nutritionnel',
        value: '23 octobre 2023 · 11h30',
        badge: 'Confirmé',
        badgeTone: 'orange',
      },
      {
        title: 'Kadiatou Keita',
        subtitle: 'Suivi du menu',
        value: '23 octobre 2023 · 14h00',
        badge: 'Confirmé',
        badgeTone: 'green',
      },
      {
        title: 'Oumar Sangaré',
        subtitle: 'Suivi des objectifs',
        value: '23 octobre 2023 · 15h30',
        badge: 'Confirmé',
        badgeTone: 'orange',
      },
    ],
    patients: [
      {
        title: 'Aïssata Diarra',
        subtitle: 'Objectif : équilibre alimentaire',
        value: 'Budget indicatif : 4 500 FCFA/j',
        badge: 'Suivi actif',
        badgeTone: 'green',
      },
      {
        title: 'Moussa Keita',
        subtitle: 'Objectif : mieux manger',
        value: 'Budget indicatif : 3 000 FCFA/j',
        badge: 'Nouveau',
        badgeTone: 'orange',
      },
      {
        title: 'Oumou Sangaré',
        subtitle: 'Objectif : diversification',
        value: 'Budget indicatif : 5 000 FCFA/j',
        badge: 'Suivi actif',
        badgeTone: 'green',
      },
    ],
    menus: [
      {
        title: 'Aïssata Diarra',
        subtitle: 'Menu de la semaine · 7 jours',
        value: 'Budget indicatif : 4 500 FCFA/j',
        badge: 'À préparer',
        badgeTone: 'orange',
      },
      {
        title: 'Moussa Keita',
        subtitle: 'Menu petit budget · 5 jours',
        value: 'Budget indicatif : 3 000 FCFA/j',
        badge: 'À valider',
        badgeTone: 'yellow',
      },
      {
        title: 'Oumou Sangaré',
        subtitle: 'Menu de diversification · 7 jours',
        value: 'Budget indicatif : 5 000 FCFA/j',
        badge: 'Publié',
        badgeTone: 'green',
      },
    ],
    'demandes-adaptation': [
      {
        title: 'Mariam Coulibaly',
        subtitle: 'Le poisson est trop cher cette semaine',
        value: 'Menu de la semaine · demandé aujourd’hui',
        badge: 'À traiter',
        badgeTone: 'orange',
      },
      {
        title: 'Boubacar Koné',
        subtitle: 'Remplacer le repas du soir',
        value: 'Menu petit budget · hier',
        badge: 'À traiter',
        badgeTone: 'yellow',
      },
      {
        title: 'Aïssata Diarra',
        subtitle: 'Ajouter une option sans arachide',
        value: 'Menu de la semaine · hier',
        badge: 'En cours',
        badgeTone: 'green',
      },
    ],
    recettes: [
      {
        title: 'Tô de mil & sauce gombo',
        subtitle: 'Plat local · repas du midi',
        value: 'Environ 650 FCFA / portion',
        badge: 'Adaptée',
        badgeTone: 'green',
      },
      {
        title: 'Salade de niébé',
        subtitle: 'Légumineuses · repas léger',
        value: 'Environ 500 FCFA / portion',
        badge: 'Adaptée',
        badgeTone: 'green',
      },
      {
        title: 'Bouillie de fonio',
        subtitle: 'Petit déjeuner',
        value: 'Environ 400 FCFA / portion',
        badge: 'À adapter',
        badgeTone: 'yellow',
      },
    ],
    'portions-couts': [
      {
        title: 'Tô de mil & sauce gombo',
        subtitle: 'Portion : 1 personne',
        value: 'Coût estimatif : 650 FCFA',
        badge: 'Dans le budget',
        badgeTone: 'green',
      },
      {
        title: 'Riz aux légumes de saison',
        subtitle: 'Portion : 1 personne',
        value: 'Coût estimatif : 800 FCFA',
        badge: 'À ajuster',
        badgeTone: 'orange',
      },
      {
        title: 'Salade de niébé',
        subtitle: 'Portion : 1 personne',
        value: 'Coût estimatif : 500 FCFA',
        badge: 'Dans le budget',
        badgeTone: 'green',
      },
    ],
    'suivi-utilisateurs': [
      {
        title: 'Aïssata Diarra',
        subtitle: 'Retours sur le menu de la semaine',
        value: 'Habitudes régulières',
        badge: 'Progression',
        badgeTone: 'green',
      },
      {
        title: 'Moussa Keita',
        subtitle: 'Retour : recettes appréciées',
        value: 'Menu à petit budget',
        badge: 'Stable',
        badgeTone: 'yellow',
      },
      {
        title: 'Oumou Sangaré',
        subtitle: 'Diversification alimentaire',
        value: 'Suivi en cours',
        badge: 'Progression',
        badgeTone: 'green',
      },
    ],
    profil: [
      {
        title: 'Informations professionnelles',
        subtitle: 'Nom, spécialité, présentation',
        value: 'Profil visible aux patients',
        badge: 'Complété',
        badgeTone: 'green',
      },
      {
        title: 'Disponibilités',
        subtitle: 'Créneaux de rendez-vous',
        value: 'Lun – Ven · 09:00 – 17:00',
        badge: 'À jour',
        badgeTone: 'green',
      },
      {
        title: 'Préférences de notification',
        subtitle: 'Demandes de menu et retours',
        value: 'Notifications activées',
        badge: 'Configuré',
        badgeTone: 'green',
      },
    ],
  },
  nutritionniste: {
    patients: [
      {
        title: 'Fatoumata Diarra',
        subtitle: 'Suivi grossesse · 2e trimestre',
        value: 'Prochain rendez-vous : aujourd’hui',
        badge: 'Suivi actif',
        badgeTone: 'green',
      },
      {
        title: 'Moussa Keita',
        subtitle: 'Équilibre alimentaire',
        value: 'Dernière consultation : 12 octobre',
        badge: 'Suivi actif',
        badgeTone: 'green',
      },
      {
        title: 'Awa Sidibé',
        subtitle: 'Première consultation',
        value: 'Rendez-vous : aujourd’hui',
        badge: 'Nouveau',
        badgeTone: 'orange',
      },
    ],
    consultations: [
      {
        title: 'Fatoumata Diarra',
        subtitle: 'Suivi grossesse · 2e trimestre',
        value: 'Aujourd’hui · 09:00',
        badge: 'Confirmée',
        badgeTone: 'green',
      },
      {
        title: 'Moussa Keita',
        subtitle: 'Équilibre alimentaire',
        value: 'Aujourd’hui · 11:30',
        badge: 'Confirmée',
        badgeTone: 'green',
      },
      {
        title: 'Awa Sidibé',
        subtitle: 'Première consultation',
        value: 'Aujourd’hui · 14:00',
        badge: 'À préparer',
        badgeTone: 'yellow',
      },
    ],
    'rendez-vous': [
      {
        title: 'Fatoumata Diarra',
        subtitle: 'Suivi grossesse · au cabinet',
        value: 'Aujourd’hui · 09:00',
        badge: 'Confirmé',
        badgeTone: 'green',
      },
      {
        title: 'Moussa Keita',
        subtitle: 'Équilibre alimentaire · en ligne',
        value: 'Aujourd’hui · 11:30',
        badge: 'Confirmé',
        badgeTone: 'green',
      },
      {
        title: 'Awa Sidibé',
        subtitle: 'Première consultation · au cabinet',
        value: 'Aujourd’hui · 14:00',
        badge: 'À confirmer',
        badgeTone: 'yellow',
      },
    ],
    recommandations: [
      {
        title: 'Mieux varier les céréales',
        subtitle: 'Conseil pratique · publié',
        value: 'Mil, fonio, riz et sorgho',
        badge: 'Publié',
        badgeTone: 'green',
      },
      {
        title: 'Ajouter des aliments riches en fer',
        subtitle: 'Suivi grossesse',
        value: 'Niébé, feuilles vertes, poisson',
        badge: 'Brouillon',
        badgeTone: 'yellow',
      },
      {
        title: 'Boire régulièrement dans la journée',
        subtitle: 'Conseil général',
        value: 'Hydratation',
        badge: 'Publié',
        badgeTone: 'green',
      },
    ],
    questions: [
      {
        title: 'Sira Traoré',
        subtitle: 'Quel aliment local est riche en fer ?',
        value: 'Question nutrition',
        badge: 'À répondre',
        badgeTone: 'orange',
      },
      {
        title: 'Mariam Diallo',
        subtitle: 'Comment remplacer le riz au dîner ?',
        value: 'Conseil alimentaire',
        badge: 'À répondre',
        badgeTone: 'yellow',
      },
      {
        title: 'Ousmane Koné',
        subtitle: 'Puis-je manger du fonio le soir ?',
        value: 'Question nutrition',
        badge: 'À répondre',
        badgeTone: 'orange',
      },
    ],
    profil: [
      {
        title: 'Informations professionnelles',
        subtitle: 'Nom, spécialité, biographie',
        value: 'Profil public',
        badge: 'Complété',
        badgeTone: 'green',
      },
      {
        title: 'Disponibilités',
        subtitle: 'Créneaux proposés aux patients',
        value: 'Lun – Ven · 09:00 – 17:00',
        badge: 'À jour',
        badgeTone: 'green',
      },
      {
        title: 'Préférences de notification',
        subtitle: 'Rendez-vous et questions reçues',
        value: 'Notifications activées',
        badge: 'Configuré',
        badgeTone: 'green',
      },
    ],
  },
};

@Component({
  selector: 'app-workspace-page',
  providers: [{ provide: MatPaginatorIntl, useFactory: frenchPaginator }],
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    DieteticienTrackingComponent,
  ],
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.css',
})
export class WorkspacePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly routeState = toSignal(
    combineLatest([this.route.parent!.paramMap, this.route.paramMap]).pipe(
      map(([parent, child]) => ({
        actor: parent.get('actor') ?? 'admin',
        section: child.get('section') ?? '',
      })),
    ),
    {
      initialValue: {
        actor: this.route.parent?.snapshot.paramMap.get('actor') ?? 'admin',
        section: this.route.snapshot.paramMap.get('section') ?? '',
      },
    },
  );
  readonly actor = computed(() => {
    const id = this.routeState().actor;
    return ACTORS[isActorId(id) ? id : 'admin'];
  });
  readonly section = computed(() => this.routeState().section);
  readonly sectionTitle = computed(
    () => SECTION_TITLES[this.section()] ?? this.section().replaceAll('-', ' '),
  );
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(MatSnackBar);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  readonly columns = ['record', 'information', 'status', 'actions'];
  private readonly notes = inject(DemoNotesService);
  readonly searchQuery = signal('');
  constructor() {
    effect(() => {
      this.routeState();
      this.searchQuery.set('');
      this.pageIndex.set(0);
    });
  }

  readonly sectionDescription = computed(
    () =>
      `Consultez et gérez ${this.sectionTitle().toLowerCase()} de votre espace ${this.actor().shortTitle.toLowerCase()}.`,
  );
  readonly sectionRows = computed<DemoRow[]>(() => {
    return DEMO_TABLES[this.actor().id][this.section()] ?? [];
  });
  readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('fr');
    if (!query) return this.sectionRows();
    return this.sectionRows().filter((row) =>
      `${row.title} ${row.subtitle} ${row.value} ${row.badge}`
        .toLocaleLowerCase('fr')
        .includes(query),
    );
  });

  readonly pagedRows = computed(() =>
    this.filteredRows().slice(
      this.pageIndex() * this.pageSize(),
      (this.pageIndex() + 1) * this.pageSize(),
    ),
  );
  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
  openDetail(row: DemoRow): void {
    const key = `${this.actor().id}/${this.section()}/${row.title}`;
    this.dialog
      .open(RecordDetailDialogComponent, {
        data: { ...row, note: this.notes.get(key) ?? '' },
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((note: string | undefined) => {
        if (note === undefined) return;
        this.notes.set(key, note);
        this.snackbar.open('Note enregistrée dans la démonstration.', 'Fermer', { duration: 4000 });
      });
  }
  initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
  updateSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.pageIndex.set(0);
  }
}
