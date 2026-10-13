import { HttpErrorResponse } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription, catchError, from, map, mergeMap, of } from 'rxjs';
import { AdminDashboardApi, AdminSearchResult } from '../../data-access/admin-dashboard.data-access';
import { AdminFoodCategory, AdminFoodPage, AdminFoodsDataAccess } from '../../data-access/admin-foods.data-access';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { WorkspaceEditorComponent } from '../../../../shared/forms/workspace-editor.component';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-categories',
  imports: [A11yModule, UiIconComponent, WorkspaceEditorComponent],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.css',
})
export class AdminCategoriesComponent {
  private readonly api = inject(AdminFoodsDataAccess);
  private readonly dashboard = inject(AdminDashboardApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly query = signal('');
  readonly appliedQuery = signal('');
  readonly result = signal<AdminFoodPage<AdminFoodCategory>>({ content: [], totalElements: 0 });
  readonly counts = signal<Record<number, number | null>>({});
  readonly state = signal<LoadState>('loading');
  readonly error = signal('');
  readonly message = signal('');
  readonly actionError = signal('');
  readonly editorOpen = signal(false);
  readonly editId = signal<number | undefined>(undefined);
  readonly selected = signal<AdminFoodCategory | null>(null);
  readonly pendingDeactivate = signal<AdminFoodCategory | null>(null);
  readonly busy = signal(false);
  readonly globalSearch = signal('');
  readonly globalResults = signal<AdminSearchResult[]>([]);
  readonly globalLoading = signal(false);
  readonly pageIndex = signal(0);
  readonly pageSize = 12;
  private readonly reloadKey = signal(0);
  readonly pageCount = computed(() => Math.ceil(this.result().totalElements / this.pageSize));
  readonly pageNumbers = computed(() => {
    const count = this.pageCount();
    const start = Math.max(0, Math.min(this.pageIndex() - 1, count - 3));
    return Array.from({ length: Math.min(3, count) }, (_, index) => start + index);
  });

  constructor() {
    effect((onCleanup) => {
      const query = this.query().trim();
      const timer = setTimeout(() => { this.pageIndex.set(0); this.appliedQuery.set(query); }, 250);
      onCleanup(() => clearTimeout(timer));
    });
    effect((onCleanup) => {
      const page = this.pageIndex();
      const query = this.appliedQuery();
      this.reloadKey();
      this.state.set('loading');
      this.error.set('');
      const subscriptions = new Subscription();
      subscriptions.add(this.api.categories(page, this.pageSize, query).subscribe({
        next: (result) => {
          if (page > 0 && page * this.pageSize >= result.totalElements) {
            this.pageIndex.set(Math.max(0, Math.ceil(result.totalElements / this.pageSize) - 1));
            return;
          }
          this.result.set(result);
          this.state.set('ready');
          this.counts.set({});
          subscriptions.add(from(result.content).pipe(
            mergeMap((category) => this.api.foods(0, 1, '', category.id).pipe(
              map((foods) => ({ id: category.id, count: foods.totalElements as number | null })),
              catchError(() => of({ id: category.id, count: null })),
            ), 4),
          ).subscribe(({ id, count }) => this.counts.update((counts) => ({ ...counts, [id]: count }))));
        },
        error: (error: unknown) => { this.error.set(this.describeError(error)); this.state.set('error'); },
      }));
      onCleanup(() => subscriptions.unsubscribe());
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
  openGlobalResult(result: AdminSearchResult): void {
    this.globalSearch.set('');
    void this.router.navigate(['/espaces/admin', result.type]);
  }
  goToPage(page: number): void { if (page >= 0 && page < this.pageCount()) this.pageIndex.set(page); }
  retry(): void { this.reloadKey.update((value) => value + 1); }
  countFor(category: AdminFoodCategory): string {
    const count = this.counts()[category.id];
    return count === undefined ? '…' : count === null ? '—' : String(count);
  }
  iconFor(category: AdminFoodCategory): string {
    const name = category.nom.toLocaleLowerCase('fr');
    if (name.includes('céréale') || name.includes('cereale')) return 'grid';
    if (name.includes('boisson')) return 'drop';
    if (name.includes('viande') || name.includes('poisson')) return 'pro';
    if (name.includes('fruit')) return 'pie';
    return 'leaf';
  }
  imageError(event: Event): void { (event.target as HTMLImageElement).hidden = true; }

  openEditor(category?: AdminFoodCategory): void {
    this.selected.set(null);
    this.editId.set(category?.id);
    this.editorOpen.set(true);
    this.actionError.set('');
  }
  closeEditor(): void { this.editorOpen.set(false); }
  editorSaved(): void {
    this.editorOpen.set(false);
    this.message.set('Catégorie enregistrée. La liste a été actualisée.');
    this.retry();
  }
  openCategory(category: AdminFoodCategory): void { this.selected.set(category); this.actionError.set(''); }
  closeCategory(): void { this.selected.set(null); }
  openFoods(category: AdminFoodCategory): void {
    void this.router.navigate(['/espaces/admin/aliments'], { queryParams: { categorieId: category.id } });
  }
  confirmDeactivate(category: AdminFoodCategory): void { this.selected.set(null); this.pendingDeactivate.set(category); this.actionError.set(''); }
  cancelDeactivate(): void { if (!this.busy()) this.pendingDeactivate.set(null); }
  deactivate(): void {
    const category = this.pendingDeactivate();
    if (!category || this.busy()) return;
    this.busy.set(true);
    this.api.deactivateCategory(category.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.pendingDeactivate.set(null);
        this.selected.set(null);
        this.message.set(`${category.nom} a été désactivée.`);
        this.retry();
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
