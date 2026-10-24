import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { PageEvent, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map } from 'rxjs';
import { frenchPaginator } from '../../core/material-french';
import { WorkspaceListService, WorkspacePageResult, WorkspaceRow } from '../data-access/workspace-list.service';
import { FoodPrice, ProfessionalMessage } from '../models/workspace-list.models';
import { ACTORS, isActorId } from './workspace-config';
import { WorkspaceEditorComponent } from '../forms/workspace-editor.component';
import { EditorKind, WorkspaceEditorService } from '../forms/workspace-editor.service';
import { SecurityComponent } from '../../features/auth/pages/securite/security.component';
import { WorkspaceAction } from '../models/workspace-list.models';
import { DieteticienRecipesComponent } from '../../features/dieteticien/pages/recettes/dieteticien-recipes.component';
import { DieteticienRecommendationsComponent } from '../../features/dieteticien/pages/recommandations/dieteticien-recommendations.component';
import { DieteticienPublishedMenusComponent } from '../../features/dieteticien/pages/menus-publies/dieteticien-published-menus.component';
import { currencyLabel } from '../utils/workspace-formatters';


const SECTION_TITLES: Record<string, string> = {
  utilisateurs: 'Utilisateurs',
  professionnels: 'Professionnels',
  aliments: 'Aliments locaux',
  categories: 'Catégories alimentaires',
  recettes: 'Recettes',
  contenus: 'Contenus publiés',
  quiz: 'Quiz', defis: 'Défis', badges: 'Badges',
  historique: 'Historique des activités',
  notifications: 'Notifications',
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
  messages: 'Messages des patients',
};

const EMPTY_RESULT: WorkspacePageResult = { rows: [], total: 0 };
type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

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
    A11yModule,
    WorkspaceEditorComponent,
    SecurityComponent,
    DieteticienRecipesComponent,
    DieteticienRecommendationsComponent,
    DieteticienPublishedMenusComponent,
  ],
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.css',
})
export class WorkspacePageComponent {
  readonly currencyLabel = currencyLabel;
  private readonly route = inject(ActivatedRoute);
  private readonly lists = inject(WorkspaceListService);
  private readonly editorApi = inject(WorkspaceEditorService);
  private readonly routeState = toSignal(
    combineLatest([this.route.parent!.paramMap, this.route.paramMap]).pipe(
      map(([parent, child]) => ({
        actor: parent.get('actor') ?? 'admin',
        section: child.get('section') ?? this.route.snapshot.data['section'] ?? '',
      })),
    ),
    {
      initialValue: {
        actor: this.route.parent?.snapshot.paramMap.get('actor') ?? 'admin',
        section: this.route.snapshot.paramMap.get('section') ?? this.route.snapshot.data['section'] ?? '',
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
  readonly sectionDescription = computed(
    () => `Consultez ${this.sectionTitle().toLowerCase()} de votre espace ${this.actor().shortTitle.toLowerCase()}.`,
  );

  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  readonly searchQuery = signal('');
  readonly adminStatus = signal('');
  readonly loadState = signal<LoadState>('loading');
  readonly errorMessage = signal('');
  readonly result = signal<WorkspacePageResult>(EMPTY_RESULT);
  readonly selectedRow = signal<WorkspaceRow | null>(null);
  readonly showList = signal(false);
  readonly editorKind = signal<EditorKind | null>(null);
  readonly editorId = signal<number | undefined>(undefined);
  readonly relatedId = signal<number | undefined>(undefined);
  readonly editorData = signal<Record<string, unknown> | undefined>(undefined);
  readonly actionBusy = signal(false);
  readonly actionError = signal('');
  readonly successMessage = signal('');
  readonly actionComment = signal('');
  readonly replyText = signal('');
  readonly recipientId = signal<number | null>(null);
  readonly progression = signal<number | null>(null);
  readonly foodPrices = signal<FoodPrice[]>([]);
  readonly foodPricesLoading = signal(false);
  readonly createdDraft = signal<{ kind: EditorKind; id: number; data: Record<string, unknown> } | null>(null);
  readonly messages = signal<ProfessionalMessage[]>([]);
  readonly messagesLoading = signal(false);
  readonly messagePage = signal(0);
  readonly messageTotal = signal(0);
  private readonly reloadCounter = signal(0);
  readonly columns = ['record', 'information', 'status', 'actions'];
  readonly createKinds = computed<EditorKind[]>(() => this.lists.createKinds(this.actor().id, this.section()));
  readonly supportsStatusFilter = computed(() => this.lists.supportsStatusFilter(this.actor().id, this.section()));
  readonly statusFilterOptions = computed(() => this.lists.statusFilterOptions(this.section()));
  readonly recordLabel = computed(() => this.lists.recordLabel(this.actor().id));
  readonly canEditProfile = computed(() => this.createKinds().includes('profile'));
  readonly isDieteticienRecipes = computed(() => this.actor().id === 'dieteticien' && this.section() === 'recettes');
  readonly isDieteticienRecommendations = computed(() => this.actor().id === 'dieteticien' && this.section() === 'recommandations');
  readonly isDieteticienMenus = computed(() => this.actor().id === 'dieteticien' && this.section() === 'menus');

  readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('fr');
    const rows = this.result().rows;
    if (!query) return rows;
    return rows.filter((row) =>
      `${row.title} ${row.subtitle} ${row.value} ${row.badge}`.toLocaleLowerCase('fr').includes(query),
    );
  });

  constructor() {
    effect(() => {
      const route = this.routeState();
      this.searchQuery.set('');
      this.adminStatus.set('');
      this.pageIndex.set(0);
      this.selectedRow.set(null);
      this.showList.set(false);
      this.editorKind.set(null);
      this.successMessage.set('');
      this.createdDraft.set(null);
    });
    effect((onCleanup) => {
      const actor = this.actor().id;
      const section = this.section();
      const page = this.pageIndex();
      const size = this.pageSize();
      const statut = this.adminStatus();
      this.reloadCounter();
      if (actor === 'dieteticien' && (section === 'recettes' || section === 'recommandations' || section === 'menus')) {
        this.loadState.set('unavailable');
        return;
      }
      const request = this.lists.load(actor, section, page, size, statut);
      this.result.set(EMPTY_RESULT);
      this.selectedRow.set(null);
      if (!request) {
        this.loadState.set('unavailable');
        return;
      }
      this.loadState.set('loading');
      const subscription = request.subscribe({
        next: (result) => {
          this.result.set(result);
          this.loadState.set('ready');
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.describeError(error));
          this.loadState.set('error');
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
  updateSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.selectedRow.set(null);
  }
  updateAdminStatus(event: Event): void {
    this.adminStatus.set((event.target as HTMLSelectElement).value);
    this.pageIndex.set(0);
  }
  retry(): void {
    this.reloadCounter.update((count) => count + 1);
  }
  toggleList(): void { this.showList.update((visible) => !visible); }
  openDetail(row: WorkspaceRow): void {
    this.selectedRow.set(row);
    this.actionError.set('');
    this.actionComment.set('');
    this.replyText.set('');
    this.recipientId.set(null);
    this.progression.set(null);
    this.foodPrices.set([]);
    if (row.detail?.showPriceList) this.loadFoodPrices(row);
    if (row.detail?.showConversation) { this.messagePage.set(0); this.loadMessages(row); }
  }
  closeDetail(): void {
    this.selectedRow.set(null);
  }
  hideBrokenImage(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }
  editorLabel(kind: EditorKind): string {
    return ({ category: 'Ajouter une catégorie', food: 'Ajouter un aliment', price: 'Ajouter un prix',
      recipe: 'Créer une recette', menu: 'Créer un menu', advice: 'Rédiger un conseil',
      article: 'Rédiger un article', profile: 'Modifier mon profil', badge: 'Créer un badge',
      challenge: 'Créer un défi', quiz: 'Créer un quiz' })[kind];
  }
  editLabel(kind: EditorKind): string {
    return ({ category: 'Modifier la catégorie', food: 'Modifier l’aliment', price: 'Modifier le prix',
      recipe: 'Modifier la recette', menu: 'Modifier le menu', advice: 'Modifier le conseil',
      article: 'Modifier l’article', profile: 'Modifier mon profil', badge: 'Modifier le badge',
      challenge: 'Modifier le défi', quiz: 'Modifier le quiz' })[kind];
  }
  openEditor(kind: EditorKind, id?: number, relatedId?: number, initialData?: Record<string, unknown>): void {
    this.editorId.set(id);
    this.relatedId.set(relatedId);
    this.editorData.set(initialData ?? (id && this.selectedRow()?.data ? this.selectedRow()?.data : undefined));
    this.editorKind.set(kind);
    this.actionError.set('');
    this.successMessage.set('');
  }
  toggleEditor(kind: EditorKind): void {
    if (this.editorKind() === kind && this.editorId() === undefined && this.relatedId() === undefined) {
      this.closeEditor();
      return;
    }
    this.openEditor(kind);
  }
  closeEditor(): void { this.editorKind.set(null); }
  editorSaved(event: { kind: EditorKind; id?: number; data: Record<string, unknown> }): void {
    const wasUpdate = this.editorId() !== undefined;
    this.editorKind.set(null);
    this.selectedRow.set(null);
    if (!wasUpdate && (event.kind === 'quiz' || event.kind === 'challenge') && event.id) {
      this.createdDraft.set({ kind: event.kind, id: event.id, data: event.data });
      this.successMessage.set(`Brouillon n° ${event.id} créé. Vous pouvez le publier ci-dessous.`);
    } else {
      this.successMessage.set('Enregistrement effectué. La liste a été actualisée.');
    }
    this.retry();
  }
  rowId(row: WorkspaceRow): number | undefined {
    const id = Number(row.key.slice(row.key.lastIndexOf('-') + 1));
    return Number.isInteger(id) && id > 0 ? id : undefined;
  }
  actionsFor(row: WorkspaceRow): WorkspaceAction[] {
    const id = this.rowId(row);
    if (!id) return [];
    const { key, badge } = row;
    return this.lists.actionsFor(this.actor().id, key, badge, id);
  }
  executeAction(action: WorkspaceAction): void {
    if (this.actionBusy()) return;
    this.actionError.set('');
    this.successMessage.set('');
    this.actionBusy.set(true);
    const request = action.method
      ? this.editorApi.mutate(action.method, action.path)
      : this.editorApi.action(action.path, action.comment ? { commentaire: this.actionComment().trim() } : {});
    request.subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.selectedRow.set(null);
        this.createdDraft.set(null);
        this.successMessage.set('Action effectuée. La liste a été actualisée.');
        this.retry();
      },
      error: (error: unknown) => {
        this.actionBusy.set(false);
        this.actionError.set(error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message : 'Cette action n’a pas pu être effectuée.');
      },
    });
  }
  updateComment(event: Event): void { this.actionComment.set((event.target as HTMLTextAreaElement).value); }
  updateReply(event: Event): void { this.replyText.set((event.target as HTMLTextAreaElement).value); }
  loadMessages(row: WorkspaceRow): void {
    const id = this.rowId(row); if (!id) return;
    this.messagesLoading.set(true);
    this.lists.messages(id, this.messagePage(), 50).subscribe({
      next: (page) => { this.messages.set(page.content); this.messageTotal.set(page.totalElements); this.messagesLoading.set(false); },
      error: () => { this.actionError.set('Impossible de charger les messages.'); this.messagesLoading.set(false); },
    });
  }
  changeMessagePage(row: WorkspaceRow, delta: number): void { this.messagePage.update((page) => page + delta); this.loadMessages(row); }
  updateRecipient(event: Event): void { const id = Number((event.target as HTMLInputElement).value); this.recipientId.set(Number.isInteger(id) && id > 0 ? id : null); }
  updateProgression(event: Event): void { const value = Number((event.target as HTMLInputElement).value); this.progression.set(Number.isInteger(value) && value > 0 ? value : null); }
  advanceChallenge(row: WorkspaceRow): void {
    const id = this.rowId(row), userId = this.recipientId(), progress = this.progression();
    if (!id || !userId || !progress || this.actionBusy()) return;
    this.actionBusy.set(true); this.actionError.set('');
    this.lists.advanceChallenge(id, userId, progress).subscribe({
      next: () => { this.actionBusy.set(false); this.successMessage.set('Progression du défi enregistrée.'); this.progression.set(null); },
      error: (error: unknown) => { this.actionBusy.set(false); this.actionError.set(this.describeError(error)); },
    });
  }
  private loadFoodPrices(row: WorkspaceRow): void {
    const id = this.rowId(row); if (!id) return;
    this.foodPricesLoading.set(true);
    this.lists.foodPrices(id).subscribe({
      next: (prices) => { this.foodPrices.set(prices); this.foodPricesLoading.set(false); },
      error: () => { this.foodPricesLoading.set(false); this.actionError.set('Prix de cet aliment indisponibles.'); },
    });
  }
  assignBadge(row: WorkspaceRow): void {
    const badgeId = this.rowId(row), userId = this.recipientId();
    if (!badgeId || !userId || this.actionBusy()) return;
    this.executeAction({ label: 'Attribuer', path: `/admin/badges/${badgeId}/attribuer/${userId}` });
  }
  sendReply(row: WorkspaceRow): void {
    const id = this.rowId(row);
    const contenu = this.replyText().trim();
    if (!id || !contenu || this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set('');
    this.lists.reply(id, contenu).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.replyText.set('');
        this.successMessage.set('Réponse envoyée au patient.');
        this.loadMessages(row);
      },
      error: (error: unknown) => {
        this.actionBusy.set(false);
        this.actionError.set(error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message : 'Impossible d’envoyer la réponse.');
      },
    });
  }
  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }
  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'Votre session a expiré. Veuillez vous reconnecter.';
      if (error.status === 403) return 'Vous n’avez pas accès à ces données.';
      if (error.status === 0) {
        return 'Le serveur est injoignable. Vérifiez que Spring Boot fonctionne sur le port 8080.';
      }

      const serverMessage = this.serverErrorMessage(error.error);
      if (serverMessage) return `Erreur ${error.status} : ${serverMessage}`;
      if (error.status >= 500) return `Erreur ${error.status} du serveur. Consultez les logs Spring Boot.`;
      if (error.status === 404) return 'La route des utilisateurs est introuvable. Vérifiez que le backend est à jour.';
      return `La requête a échoué (HTTP ${error.status}).`;
    }
    return 'Impossible de charger les données pour le moment.';
  }

  private serverErrorMessage(payload: unknown): string {
    if (typeof payload === 'string') return payload.slice(0, 240);
    if (!payload || typeof payload !== 'object') return '';

    const body = payload as Record<string, unknown>;
    for (const key of ['message', 'detail', 'error']) {
      const value = body[key];
      if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 240);
    }
    return '';
  }
}
