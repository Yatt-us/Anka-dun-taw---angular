import { HttpErrorResponse } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription, catchError, from, map, mergeMap, of } from 'rxjs';
import { AdminDashboardApi, AdminSearchResult } from '../../data-access/admin-dashboard.data-access';
import { AdminRecipe, AdminRecipesDataAccess } from '../../data-access/admin-recipes.data-access';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { WorkspaceEditorComponent } from '../../../../shared/forms/workspace-editor.component';

type LoadState = 'loading' | 'ready' | 'error';
type BudgetFilter = 'all' | 'eco' | 'medium' | 'high' | 'unknown';

@Component({
  selector: 'app-admin-recipes',
  imports: [A11yModule, UiIconComponent, WorkspaceEditorComponent],
  templateUrl: './admin-recipes.component.html',
  styleUrl: './admin-recipes.component.css',
})
export class AdminRecipesComponent {
  private readonly api = inject(AdminRecipesDataAccess);
  private readonly dashboard = inject(AdminDashboardApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly query = signal('');
  readonly appliedQuery = signal('');
  readonly status = signal<AdminRecipe['statut']>('PUBLIEE');
  readonly duration = signal(0);
  readonly budget = signal<BudgetFilter>('all');
  readonly allRecipes = signal<AdminRecipe[]>([]);
  readonly total = signal(0);
  readonly costs = signal<Record<number, number | null>>({});
  readonly costLoading = signal(false);
  readonly state = signal<LoadState>('loading');
  readonly loadingMore = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly actionError = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = 6;
  readonly editorOpen = signal(false);
  readonly editId = signal<number | undefined>(undefined);
  readonly selected = signal<AdminRecipe | null>(null);
  readonly detailLoading = signal(false);
  readonly pendingArchive = signal<AdminRecipe | null>(null);
  readonly busy = signal(false);
  readonly globalSearch = signal('');
  readonly globalResults = signal<AdminSearchResult[]>([]);
  readonly globalLoading = signal(false);
  private readonly reloadKey = signal(0);
  private detailRequest?: Subscription;

  readonly durationFiltered = computed(() => this.allRecipes().filter((recipe) =>
    !this.duration() || (recipe.dureePreparationMinutes != null && recipe.dureePreparationMinutes <= this.duration()),
  ));
  readonly filtered = computed(() => {
    const budget = this.budget();
    const costs = this.costs();
    return this.durationFiltered().filter((recipe) => {
      if (budget === 'all') return true;
      const cost = costs[recipe.id];
      if (cost === undefined) return false;
      if (budget === 'unknown') return cost === null;
      if (cost === null) return false;
      const perPerson = cost / Math.max(1, recipe.nombrePersonnes || 1);
      return budget === 'eco' ? perPerson <= 500 : budget === 'medium' ? perPerson > 500 && perPerson <= 1000 : perPerson > 1000;
    });
  });
  readonly pageCount = computed(() => Math.ceil(this.filtered().length / this.pageSize));
  readonly visible = computed(() => this.filtered().slice(this.pageIndex() * this.pageSize, (this.pageIndex() + 1) * this.pageSize));
  readonly firstVisible = computed(() => this.filtered().length ? this.pageIndex() * this.pageSize + 1 : 0);
  readonly lastVisible = computed(() => Math.min((this.pageIndex() + 1) * this.pageSize, this.filtered().length));
  readonly pageNumbers = computed(() => {
    const count = this.pageCount();
    const start = Math.max(0, Math.min(this.pageIndex() - 1, count - 3));
    return Array.from({ length: Math.min(3, count) }, (_, index) => start + index);
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.detailRequest?.unsubscribe());
    effect((onCleanup) => {
      const query = this.query().trim();
      const timer = setTimeout(() => { this.pageIndex.set(0); this.appliedQuery.set(query); }, 250);
      onCleanup(() => clearTimeout(timer));
    });
    effect((onCleanup) => {
      const query = this.appliedQuery();
      const status = this.status();
      this.reloadKey();
      this.state.set('loading');
      this.error.set('');
      this.pageIndex.set(0);
      this.allRecipes.set([]);
      this.costs.set({});
      const subscriptions = new Subscription();
      subscriptions.add(this.api.recipes(0, 200, query, status).subscribe({
        next: (first) => {
          this.allRecipes.set(first.content);
          this.total.set(first.totalElements);
          this.state.set('ready');
          const pages = Math.ceil(first.totalElements / 200);
          if (pages <= 1) return;
          this.loadingMore.set(true);
          for (let page = 1; page < pages; page += 1) {
            subscriptions.add(this.api.recipes(page, 200, query, status).subscribe({
              next: (result) => { this.allRecipes.update((items) => [...items, ...result.content]); if (this.allRecipes().length >= first.totalElements) this.loadingMore.set(false); },
              error: () => { this.loadingMore.set(false); this.actionError.set('Une partie des recettes n’a pas pu être chargée.'); },
            }));
          }
        },
        error: (error: unknown) => { this.error.set(this.describeError(error)); this.state.set('error'); },
      }));
      onCleanup(() => subscriptions.unsubscribe());
    });
    effect((onCleanup) => {
      const all = this.durationFiltered();
      const budget = this.budget();
      const page = this.pageIndex();
      const targets = budget === 'all' ? all.slice(page * this.pageSize, (page + 1) * this.pageSize) : all;
      const existing = untracked(this.costs);
      const missing = targets.filter((recipe) => !(recipe.id in existing));
      this.costLoading.set(budget !== 'all' && missing.length > 0);
      if (!missing.length) return;
      const subscription = from(missing).pipe(
        mergeMap((recipe) => this.api.cost(recipe.id).pipe(
          map((cost) => ({ id: recipe.id, value: cost?.coutEstime ?? null })),
          catchError(() => of({ id: recipe.id, value: null })),
        ), 4),
      ).subscribe({
        next: ({ id, value }) => {
          this.costs.update((costs) => ({ ...costs, [id]: value }));
          if (budget !== 'all' && targets.every((item) => item.id === id || item.id in this.costs())) this.costLoading.set(false);
        },
        complete: () => this.costLoading.set(false),
      });
      onCleanup(() => subscription.unsubscribe());
    });
    effect((onCleanup) => {
      const query = this.globalSearch().trim();
      this.globalResults.set([]);
      this.globalLoading.set(query.length >= 2);
      if (query.length < 2) return;
      let subscription: Subscription | undefined;
      const timer = setTimeout(() => {
        subscription = this.dashboard.search(query).subscribe({
          next: (results) => { this.globalResults.set(results); this.globalLoading.set(false); },
          error: () => this.globalLoading.set(false),
        });
      }, 250);
      onCleanup(() => { clearTimeout(timer); subscription?.unsubscribe(); });
    });
  }

  setQuery(event: Event): void { this.query.set((event.target as HTMLInputElement).value); }
  setGlobalSearch(event: Event): void { this.globalSearch.set((event.target as HTMLInputElement).value); }
  setBudget(event: Event): void { this.budget.set((event.target as HTMLSelectElement).value as BudgetFilter); this.pageIndex.set(0); }
  setDuration(event: Event): void { this.duration.set(Number((event.target as HTMLSelectElement).value)); this.pageIndex.set(0); }
  setStatus(event: Event): void { this.status.set((event.target as HTMLSelectElement).value as AdminRecipe['statut']); }
  openGlobalResult(result: AdminSearchResult): void { this.globalSearch.set(''); void this.router.navigate(['/espaces/admin', result.type]); }
  goToPage(page: number): void { if (page >= 0 && page < this.pageCount()) this.pageIndex.set(page); }
  retry(): void { this.reloadKey.update((value) => value + 1); }
  durationLabel(recipe: AdminRecipe): string { return recipe.dureePreparationMinutes == null ? 'Durée non renseignée' : `${recipe.dureePreparationMinutes} min`; }
  budgetLabel(recipe: AdminRecipe): string {
    const cost = this.costs()[recipe.id];
    if (cost === undefined) return 'Budget : calcul…';
    if (cost === null) return 'Budget : non renseigné';
    const perPerson = cost / Math.max(1, recipe.nombrePersonnes || 1);
    return `Budget : ${perPerson <= 500 ? 'Éco' : perPerson <= 1000 ? 'Moyen' : 'Élevé'}`;
  }
  imageError(event: Event): void { (event.target as HTMLImageElement).hidden = true; }
  openEditor(recipe?: AdminRecipe): void {
    this.closeDetail();
    this.editId.set(recipe?.statut === 'BROUILLON' ? recipe.id : undefined);
    this.editorOpen.set(true);
    this.actionError.set('');
  }
  closeEditor(): void { this.editorOpen.set(false); }
  editorSaved(): void {
    this.editorOpen.set(false);
    this.message.set('Recette enregistrée comme brouillon.');
    if (this.status() === 'BROUILLON') this.retry();
    else this.status.set('BROUILLON');
  }
  openDetail(recipe: AdminRecipe): void {
    this.detailRequest?.unsubscribe();
    this.selected.set(recipe);
    this.detailLoading.set(true);
    this.detailRequest = this.api.detail(recipe.id).subscribe({
      next: (detail) => { this.selected.set(detail); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false),
    });
  }
  closeDetail(): void { this.detailRequest?.unsubscribe(); this.selected.set(null); }
  confirmArchive(recipe: AdminRecipe): void { this.closeDetail(); this.pendingArchive.set(recipe); this.actionError.set(''); }
  cancelArchive(): void { if (!this.busy()) this.pendingArchive.set(null); }
  archive(): void {
    const recipe = this.pendingArchive();
    if (!recipe || this.busy()) return;
    this.busy.set(true);
    this.api.archive(recipe.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.busy.set(false); this.pendingArchive.set(null); this.message.set(`${recipe.nom} a été archivée.`); this.retry(); },
      error: (error: unknown) => { this.busy.set(false); this.actionError.set(this.describeError(error)); },
    });
  }
  publish(recipe: AdminRecipe): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.publish(recipe.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.closeDetail();
        this.message.set(`${recipe.nom} a été publiée.`);
        if (this.status() === 'PUBLIEE') this.retry();
        else this.status.set('PUBLIEE');
      },
      error: (error: unknown) => { this.busy.set(false); this.actionError.set(this.describeError(error)); },
    });
  }
  restore(recipe: AdminRecipe): void {
    if (this.busy() || recipe.statut !== 'ARCHIVEE') return;
    this.busy.set(true);
    this.api.restore(recipe.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.closeDetail();
        this.message.set(`${recipe.nom} a été désarchivée et publiée.`);
        if (this.status() === 'PUBLIEE') this.retry();
        else this.status.set('PUBLIEE');
      },
      error: (error: unknown) => { this.busy.set(false); this.actionError.set(this.describeError(error)); },
    });
  }
  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Le serveur est injoignable. Vérifiez la connexion au backend.';
      if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous.';
      if (error.status === 403) return 'Vous n’avez pas accès à cette action.';
      const body = error.error;
      if (body && typeof body.message === 'string') return body.message;
      return `La requête a échoué (HTTP ${error.status}).`;
    }
    return 'Cette opération a échoué. Réessayez.';
  }
}
