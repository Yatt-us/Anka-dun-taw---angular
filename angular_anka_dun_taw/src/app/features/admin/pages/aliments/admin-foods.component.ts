import { HttpErrorResponse } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminDashboardApi, AdminSearchResult } from '../../data-access/admin-dashboard.data-access';
import { AdminFood, AdminFoodCategory, AdminFoodPage, AdminFoodsDataAccess } from '../../data-access/admin-foods.data-access';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { WorkspaceEditorComponent } from '../../../../shared/forms/workspace-editor.component';
import { FoodPrice } from '../../../../shared/models/workspace-list.models';
import { MALI_ZONES, ZoneOption, ZonesDataAccess, zoneLabel } from '../../../../shared/data-access/zones.data-access';
import { currentPricesForZone } from './current-prices';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-foods',
  imports: [A11yModule, UiIconComponent, WorkspaceEditorComponent],
  templateUrl: './admin-foods.component.html',
  styleUrl: './admin-foods.component.css',
})
export class AdminFoodsComponent {
  private readonly api = inject(AdminFoodsDataAccess);
  private readonly dashboard = inject(AdminDashboardApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zonesApi = inject(ZonesDataAccess);
  private detailRequest?: Subscription;

  readonly search = signal('');
  readonly appliedSearch = signal('');
  readonly categoryId = signal<number | null>(null);
  readonly categories = signal<AdminFoodCategory[]>([]);
  readonly categoriesError = signal(false);
  readonly pageIndex = signal(0);
  readonly pageSize = 7;
  readonly result = signal<AdminFoodPage<AdminFood>>({ content: [], totalElements: 0 });
  readonly state = signal<LoadState>('loading');
  readonly error = signal('');
  readonly message = signal('');
  readonly actionError = signal('');
  readonly busy = signal(false);
  readonly exporting = signal(false);
  readonly editorOpen = signal(false);
  readonly editId = signal<number | undefined>(undefined);
  readonly selectedFood = signal<AdminFood | null>(null);
  readonly foodPrices = signal<FoodPrice[]>([]);
  readonly viewMode = signal<'nutrition' | 'prices'>('nutrition');
  readonly priceZone = signal('BAMAKO');
  readonly priceZones = signal<ZoneOption[]>([...MALI_ZONES]);
  readonly pagePrices = signal<Record<number, FoodPrice | null>>({});
  readonly pagePricesError = signal(false);
  readonly priceEditorFood = signal<AdminFood | null>(null);
  readonly pricesLoading = signal(false);
  readonly pricesError = signal(false);
  readonly pendingDeactivate = signal<AdminFood | null>(null);
  readonly globalSearch = signal('');
  readonly globalResults = signal<AdminSearchResult[]>([]);
  readonly globalLoading = signal(false);
  private readonly reloadKey = signal(0);

  readonly pageCount = computed(() => Math.ceil(this.result().totalElements / this.pageSize));
  readonly pageNumbers = computed(() => {
    const count = this.pageCount();
    const start = Math.max(0, Math.min(this.pageIndex() - 1, count - 3));
    return Array.from({ length: Math.min(3, count) }, (_, index) => start + index);
  });
  readonly firstVisible = computed(() => this.result().totalElements ? this.pageIndex() * this.pageSize + 1 : 0);
  readonly lastVisible = computed(() => Math.min((this.pageIndex() + 1) * this.pageSize, this.result().totalElements));
  readonly pricesReady = computed(() => this.viewMode() !== 'prices' || (!this.pagePricesError() && this.result().content.every((food) => Object.hasOwn(this.pagePrices(), food.id))));
  readonly displayedFoodPrices = computed(() => {
    const prices = this.foodPrices();
    if (this.viewMode() !== 'prices') return prices;
    const today = new Date().toISOString().slice(0, 10);
    return currentPricesForZone(prices, this.priceZone(), today);
  });

  constructor() {
    this.zonesApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (zones) => this.priceZones.set(zones),
      error: () => this.actionError.set('Impossible de charger les régions.'),
    });
    const initialCategory = Number(this.route.snapshot.queryParamMap.get('categorieId'));
    if (Number.isInteger(initialCategory) && initialCategory > 0) this.categoryId.set(initialCategory);
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.viewMode.set(params.get('vue') === 'prix' ? 'prices' : 'nutrition');
    });
    this.api.categories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => this.categories.set(page.content),
      error: () => this.categoriesError.set(true),
    });
    this.destroyRef.onDestroy(() => this.detailRequest?.unsubscribe());

    effect((onCleanup) => {
      const query = this.search().trim();
      const timer = setTimeout(() => {
        this.pageIndex.set(0);
        this.appliedSearch.set(query);
      }, 250);
      onCleanup(() => clearTimeout(timer));
    });

    effect((onCleanup) => {
      const page = this.pageIndex();
      const query = this.appliedSearch();
      const category = this.categoryId();
      this.reloadKey();
      this.state.set('loading');
      this.error.set('');
      const subscription = this.api.foods(page, this.pageSize, query, category).subscribe({
        next: (result) => {
          if (page > 0 && page * this.pageSize >= result.totalElements) {
            this.pageIndex.set(Math.max(0, Math.ceil(result.totalElements / this.pageSize) - 1));
            return;
          }
          this.result.set(result);
          this.state.set('ready');
        },
        error: (error: unknown) => {
          this.error.set(this.describeError(error));
          this.state.set('error');
        },
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

    effect((onCleanup) => {
      const foods = this.result().content;
      if (this.viewMode() !== 'prices' || this.state() !== 'ready') return;
      const zone = this.priceZone();
      this.pagePrices.set({});
      this.pagePricesError.set(false);
      if (!foods.length) return;
      const subscription = this.api.currentPrices(zone, foods.map((food) => food.id)).subscribe({
        next: (prices) => {
          const byId: Record<number, FoodPrice | null> = Object.fromEntries(foods.map((food) => [food.id, null]));
          for (const price of prices) {
            if (price.alimentId != null && Object.hasOwn(byId, price.alimentId)) byId[price.alimentId] = price;
          }
          this.pagePrices.set(byId);
        },
        error: () => this.pagePricesError.set(true),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  switchView(mode: 'nutrition' | 'prices'): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { vue: mode === 'prices' ? 'prix' : null }, queryParamsHandling: 'merge' });
  }

  openPriceEditor(food: AdminFood): void { this.priceEditorFood.set(food); }
  closePriceEditor(): void { this.priceEditorFood.set(null); }
  priceSaved(): void {
    this.priceEditorFood.set(null);
    this.message.set('Prix enregistré. Les données ont été actualisées.');
    this.retry();
  }

  season(food: AdminFood): string {
    const start = food.moisDebutSaison;
    const end = food.moisFinSaison;
    if (!start || !end || start < 1 || end > 12) return 'Non renseignée';
    if (start === 1 && end === 12) return 'Toute l’année';
    const month = (value: number) => new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(2024, value - 1, 1));
    return `${month(start)} – ${month(end)}`;
  }

  formatPrice(price: FoodPrice | null | undefined): string {
    if (price === undefined) return this.pagePricesError() ? 'Indisponible' : 'Chargement…';
    if (!price) return '—';
    const amount = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(price.prix);
    const unit = price.quantiteReference && price.unite ? ` / ${price.quantiteReference} ${price.unite}` : '';
    return `${amount} ${price.devise || 'FCFA'}${unit}`;
  }

  zoneName(code: string): string { return zoneLabel(code); }

  setPriceZone(event: Event): void {
    this.priceZone.set((event.target as HTMLSelectElement).value);
  }

  setSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  setGlobalSearch(event: Event): void { this.globalSearch.set((event.target as HTMLInputElement).value); }
  setCategory(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.categoryId.set(Number.isInteger(value) && value > 0 ? value : null);
    this.pageIndex.set(0);
  }
  goToPage(index: number): void {
    if (index >= 0 && index < this.pageCount()) this.pageIndex.set(index);
  }
  retry(): void { this.reloadKey.update((value) => value + 1); }

  openGlobalResult(result: AdminSearchResult): void {
    this.globalSearch.set('');
    if (result.type === 'aliments') {
      this.search.set(result.titre);
      return;
    }
    void this.router.navigate(['/espaces/admin', result.type]);
  }

  openEditor(food?: AdminFood): void {
    this.closeDetail();
    this.editId.set(food?.id);
    this.editorOpen.set(true);
    this.actionError.set('');
  }
  closeEditor(): void { this.editorOpen.set(false); }
  editorSaved(): void {
    this.editorOpen.set(false);
    this.message.set('Aliment enregistré. La liste a été actualisée.');
    this.retry();
  }

  openDetail(food: AdminFood): void {
    this.detailRequest?.unsubscribe();
    this.selectedFood.set(food);
    this.foodPrices.set([]);
    this.pricesError.set(false);
    this.pricesLoading.set(true);
    this.detailRequest = this.api.prices(food.id).subscribe({
      next: (prices) => { this.foodPrices.set(prices); this.pricesLoading.set(false); },
      error: () => { this.pricesError.set(true); this.pricesLoading.set(false); },
    });
  }
  closeDetail(): void { this.detailRequest?.unsubscribe(); this.selectedFood.set(null); }
  confirmDeactivate(food: AdminFood): void {
    this.pendingDeactivate.set(food);
    this.actionError.set('');
  }
  cancelDeactivate(): void { if (!this.busy()) this.pendingDeactivate.set(null); }
  deactivate(): void {
    const food = this.pendingDeactivate();
    if (!food || this.busy()) return;
    this.busy.set(true);
    this.api.deactivate(food.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.pendingDeactivate.set(null);
        this.selectedFood.set(null);
        this.message.set(`${food.nom} a été désactivé.`);
        this.retry();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(this.describeError(error));
      },
    });
  }

  async exportCsv(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.actionError.set('');
    try {
      if (this.viewMode() === 'prices') {
        const header = ['Nom', 'Catégorie', 'Prix', 'Devise', 'Quantité de référence', 'Unité', 'Zone', 'Saison', 'Début du prix', 'Fin du prix'];
        const lines = this.result().content.map((food) => {
          const price = this.pagePrices()[food.id];
          return [food.nom, food.categorieNom ?? '', price?.prix ?? '', price?.devise ?? '', price?.quantiteReference ?? '', price?.unite ?? '', price?.zone ?? '', this.season(food), price?.dateDebut ?? '', price?.dateFin ?? '']
            .map(this.csvCell).join(';');
        });
        this.downloadCsv(header, lines, 'prix-saisonnalite-anka-dun-taw-page.csv');
        return;
      }
      const query = this.appliedSearch();
      const category = this.categoryId();
      const foods: AdminFood[] = [];
      let page = 0;
      let total = 0;
      do {
        const result = await firstValueFrom(this.api.foods(page, 200, query, category));
        foods.push(...result.content);
        total = result.totalElements;
        page += 1;
        if (!result.content.length) break;
      } while (foods.length < total);
      const header = ['Nom', 'Catégorie', 'Calories/100g', 'Protéines (g)', 'Lipides (g)', 'Glucides (g)', 'Disponible'];
      const lines = foods.map((food) => [
        food.nom, food.categorieNom ?? '', food.calories ?? '', food.proteines ?? '',
        food.lipides ?? '', food.glucides ?? '', food.disponible ? 'Oui' : 'Non',
      ].map(this.csvCell).join(';'));
      this.downloadCsv(header, lines, 'aliments-locaux-anka-dun-taw.csv');
    } catch (error) {
      this.actionError.set(this.describeError(error));
    } finally {
      this.exporting.set(false);
    }
  }

  formatMetric(value: number | null | undefined, unit: string): string {
    return value == null ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} ${unit}`;
  }
  imageError(event: Event): void { (event.target as HTMLImageElement).hidden = true; }

  private csvCell(value: string | number): string {
    let text = String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  private downloadCsv(header: string[], lines: string[], filename: string): void {
    const csv = '\uFEFF' + [header.map(this.csvCell).join(';'), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
