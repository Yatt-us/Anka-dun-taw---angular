import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { A11yModule } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { AdaptationRequest, DietitianDashboardApi, DietitianBeneficiary, DietitianMenu } from '../../data-access/dieteticien-dashboard.data-access';
import { API_BASE_URL } from '../../../../core/config/api.config';

interface ApiPage<T> { content: T[] }
interface Meal { recetteId: number; jour: number; typeRepas: string; nombrePortions: number; commentaire?: string }
interface Menu extends DietitianMenu {
  description?: string; type: string; dateDebut: string; dateFin?: string;
  recommandations?: string; zone?: string; repas: Meal[];
}
interface Request extends AdaptationRequest {
  reponse?: string; menuReviseId?: number; createdAt?: string; dateCreation?: string; priorite?: string;
}
interface Recipe { id: number; nom: string }
interface Budget { id: number; montant: number; devise?: string; periode?: string; actif?: boolean }

@Component({
  selector: 'app-adaptations',
  imports: [FormsModule, RouterLink, A11yModule, UiIconComponent],
  templateUrl: './adaptations.component.html',
  styleUrl: './adaptations.component.css',
})
export class AdaptationsComponent {
  private readonly http = inject(HttpClient);
  private readonly api = inject(DietitianDashboardApi);
  private readonly destroyRef = inject(DestroyRef);
  private selectionGeneration = 0;
  readonly menus = signal<DietitianMenu[]>([]);
  readonly recipes = signal<Recipe[]>([]);
  readonly requests = signal<Request[]>([]);
  readonly selectedMenu = signal<Menu | null>(null);
  readonly focusedRequest = signal<Request | null>(null);
  readonly selectedRequest = signal<Request | null>(null);
  readonly beneficiaries = signal<DietitianBeneficiary[]>([]);
  readonly patientBudget = signal<Budget | null>(null);
  readonly decision = signal<'accept' | 'refuse'>('refuse');
  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly searchQuery = signal('');
  readonly statusFilter = signal('EN_ATTENTE');
  readonly priorityFilter = signal('TOUTES');
  readonly priorities = computed(() => [...new Set(this.requests().map((request) => request.priorite).filter((value): value is string => !!value))]);
  readonly filteredRequests = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('fr');
    return this.requests().filter((request) => {
      if (this.statusFilter() !== 'TOUS' && request.statut !== this.statusFilter() &&
        !(this.statusFilter() === 'EN_ATTENTE' && request.statut === 'EN_COURS')) return false;
      if (this.priorityFilter() !== 'TOUTES' && request.priorite !== this.priorityFilter()) return false;
      if (!query) return true;
      return [this.patientName(request.demandeurId), request.motif, this.menuTitle(request.menuId)]
        .some((value) => value.toLocaleLowerCase('fr').includes(query));
    });
  });
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());
  response = '';
  revisionTitle = '';
  revisionStart = '';
  revisionEnd = '';
  revisionNotes = '';
  revisionMeals: Meal[] = [];

  constructor() {
    this.load();
    this.api.beneficiaries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (patients) => this.beneficiaries.set(patients),
    });
    this.http.get<ApiPage<Recipe>>(`${API_BASE_URL}/recettes`, { params: new HttpParams().set('size', '200') })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (page) => this.recipes.set(page.content) });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.menus().pipe(
      switchMap((menus) => {
        this.menus.set(menus);
        return this.api.adaptations(menus);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (requests) => {
        this.requests.set(requests as Request[]);
        this.loading.set(false);
        const current = requests.find((request) => request.id === this.focusedRequest()?.id);
        this.focus((current ?? requests.find((request) => request.statut === 'EN_ATTENTE' || request.statut === 'EN_COURS') ?? requests[0] ?? null) as Request | null);
      },
      error: (cause: unknown) => {
        this.loading.set(false);
        this.error.set(this.describe(cause, 'Impossible de charger les demandes d’adaptation.'));
      },
    });
  }

  focus(request: Request | null): void {
    if (request && this.focusedRequest() === request && this.selectedMenu()) return;
    const generation = ++this.selectionGeneration;
    this.focusedRequest.set(request);
    this.selectedRequest.set(null);
    this.selectedMenu.set(null);
    this.patientBudget.set(null);
    this.response = request?.reponse ?? '';
    if (!request) { this.detailLoading.set(false); return; }
    this.detailLoading.set(true);
    forkJoin({
      menu: this.http.get<Menu>(`${API_BASE_URL}/professionnel/menus/${request.menuId}`),
      budgets: this.http.get<ApiPage<Budget>>(`${API_BASE_URL}/professionnel/beneficiaires/${request.demandeurId}/budgets`, {
        params: new HttpParams().set('page', '0').set('size', '100'),
      }).pipe(catchError(() => of({ content: [] as Budget[] }))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ menu, budgets }) => {
        if (generation !== this.selectionGeneration) return;
        this.selectedMenu.set(menu);
        this.patientBudget.set(budgets.content.find((item) => item.actif) ?? budgets.content[0] ?? null);
        this.prepareRevision(menu);
        this.detailLoading.set(false);
      },
      error: (cause: unknown) => {
        if (generation !== this.selectionGeneration) return;
        this.detailLoading.set(false);
        this.error.set(this.describe(cause, 'Impossible de charger le détail du menu.'));
      },
    });
  }

  menuTitle(id: number): string { return this.menus().find((menu) => menu.id === id)?.titre ?? `Menu n° ${id}`; }
  recipeListed(id: number): boolean { return this.recipes().some((recipe) => recipe.id === id); }
  recipeName(id: number): string { return this.recipes().find((recipe) => recipe.id === id)?.nom ?? `Recette n° ${id}`; }
  patientName(id: number): string {
    const patient = this.beneficiaries().find((item) => item.id === id);
    return patient ? [patient.prenom, patient.nom].filter(Boolean).join(' ') : `Patient n° ${id}`;
  }
  patientPhoto(id: number): string | null { return this.beneficiaries().find((item) => item.id === id)?.photoProfilUrl || null; }
  hideBrokenImage(event: Event): void { (event.target as HTMLImageElement).remove(); }
  money(amount: number | null | undefined, devise = 'XOF'): string {
    return amount == null ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} ${devise === 'XOF' ? 'FCFA' : devise}`;
  }
  requestDate(request: Request): string {
    const raw = request.createdAt ?? request.dateCreation;
    if (!raw) return `Demande n° ${request.id}`;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? `Demande n° ${request.id}` : `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)} · n° ${request.id}`;
  }
  requestSubject(request: Request): string {
    const motif = request.motif?.trim() || 'Adaptation du menu demandée';
    const end = motif.search(/[.!?\n]/);
    return end > 0 ? motif.slice(0, end + 1) : motif;
  }
  requestDescription(request: Request): string {
    const motif = request.motif?.trim() || '';
    const subject = this.requestSubject(request);
    return motif.length > subject.length ? motif.slice(subject.length).trim() : '';
  }
  statusLabel(value: string): string {
    return ({ EN_ATTENTE: 'En attente', EN_COURS: 'En cours', TRAITEE: 'Traitée', REFUSEE: 'Refusée' } as Record<string, string>)[value] ?? value;
  }
  menuMealTitle(menu: Menu): string {
    const meal = menu.repas?.[0];
    return meal ? `${this.recipeName(meal.recetteId)}${menu.repas.length > 1 ? ` et ${menu.repas.length - 1} autre(s) repas` : ''}` : menu.titre;
  }
  hasDraftChanges(): boolean {
    const menu = this.selectedMenu();
    return !!menu && (JSON.stringify(this.revisionMeals) !== JSON.stringify(this.sourceMeals(menu)) ||
      this.revisionNotes !== (menu.recommandations ?? '') ||
      this.revisionStart !== menu.dateDebut || this.revisionEnd !== (menu.dateFin ?? ''));
  }
  resetDraft(): void { const menu = this.selectedMenu(); if (menu) this.prepareRevision(menu); }
  private prepareRevision(menu: Menu): void {
    this.revisionTitle = `${menu.titre} — adapté`;
    this.revisionStart = menu.dateDebut;
    this.revisionEnd = menu.dateFin ?? '';
    this.revisionNotes = menu.recommandations ?? '';
    this.revisionMeals = this.sourceMeals(menu);
  }
  private sourceMeals(menu: Menu): Meal[] {
    return (menu.repas ?? []).map((meal) => ({
      recetteId: meal.recetteId, jour: meal.jour, typeRepas: meal.typeRepas,
      nombrePortions: meal.nombrePortions, commentaire: meal.commentaire,
    }));
  }
  choose(request: Request, decision: 'accept' | 'refuse'): void {
    if (!this.selectedMenu() || this.focusedRequest()?.id !== request.id || this.detailLoading()) return;
    this.selectedRequest.set(request);
    this.decision.set(decision);
    this.error.set('');
    this.success.set('');
  }
  closeDecision(): void { if (!this.saving()) this.selectedRequest.set(null); }
  submit(): void {
    const request = this.selectedRequest(), menu = this.selectedMenu();
    if (!request || !menu || this.saving()) return;
    if (!this.response.trim()) { this.error.set('Une réponse au patient est obligatoire.'); return; }
    const accepte = this.decision() === 'accept';
    if (accepte && !this.hasDraftChanges()) {
      this.error.set('Modifiez au moins un repas, une date ou une recommandation avant de créer le menu révisé.'); return;
    }
    if (accepte && (!this.revisionTitle.trim() || !this.revisionStart || !this.revisionMeals.length ||
      this.revisionMeals.some((meal) => !meal.recetteId || !Number.isInteger(meal.jour) || meal.jour < 1 ||
        meal.jour > 31 || !Number.isFinite(meal.nombrePortions) || meal.nombrePortions <= 0))) {
      this.error.set('Complétez le menu révisé et tous ses repas.'); return;
    }
    if (accepte && this.revisionEnd && this.revisionEnd < this.revisionStart) {
      this.error.set('La date de fin doit suivre la date de début.'); return;
    }
    const body = accepte ? { acceptee: true, reponse: this.response.trim(), menuRevise: {
      titre: this.revisionTitle.trim(), description: menu.description, type: menu.type,
      dateDebut: this.revisionStart, dateFin: this.revisionEnd || null,
      recommandations: this.revisionNotes, zone: menu.zone, beneficiaireIds: [request.demandeurId],
      repas: this.revisionMeals,
    } } : { acceptee: false, reponse: this.response.trim() };
    this.saving.set(true); this.error.set('');
    this.http.post(`${API_BASE_URL}/professionnel/menus/demandes-adaptation/${request.id}/traiter`, body)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.selectedRequest.set(null);
        this.success.set(accepte ? 'Menu révisé créé. Validez puis publiez-le dans « Mes menus ».' : 'Demande refusée et réponse enregistrée.');
        this.load();
      },
      error: (cause: unknown) => { this.saving.set(false); this.error.set(this.describe(cause, 'Le traitement de la demande a échoué.')); },
    });
  }
  private describe(cause: unknown, fallback: string): string {
    return cause instanceof HttpErrorResponse && typeof cause.error?.message === 'string' ? cause.error.message : fallback;
  }
}
