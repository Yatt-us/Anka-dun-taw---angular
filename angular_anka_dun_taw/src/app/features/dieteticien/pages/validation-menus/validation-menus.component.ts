import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { EMPTY, catchError, expand, forkJoin, Observable, of, reduce, switchMap } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { WorkspaceEditorComponent } from '../../../../shared/forms/workspace-editor.component';
import { DietitianBeneficiary, DietitianDashboardApi, DietitianMenu } from '../../data-access/dieteticien-dashboard.data-access';

interface ApiPage<T> { content: T[]; number: number; totalPages: number }
interface Meal { id?: number; recetteId: number; jour: number; typeRepas: string; nombrePortions: number; commentaire?: string | null }
interface MenuDetail extends DietitianMenu {
  description?: string | null; type?: string; dateDebut?: string; dateFin?: string | null;
  zone?: string | null; recommandations?: string | null; repas?: Meal[] | null;
  budgetId?: number | null;
}
interface MealCost {
  repasId: number; recetteNom: string; jour: number; typeRepas: string; nombrePortions: number;
  coutTotalEstime: number | null; prixDisponible: boolean;
}
interface MenuCost { menuId: number; coutTotalEstime: number | null; devise: string; prixDisponibles: boolean; repas: MealCost[] }
interface Budget { id: number; montant: number; devise: string; periode: string; actif: boolean }
interface Recipe { id: number; nom: string }
interface MealView { key: string; title: string; detail: string; cost: number | null }
type BudgetCheck = 'respected' | 'exceeded' | 'unknown';

@Component({
  selector: 'app-validation-menus',
  imports: [RouterLink, A11yModule, UiIconComponent, WorkspaceEditorComponent],
  templateUrl: './validation-menus.component.html',
  styleUrl: './validation-menus.component.css',
})
export class ValidationMenusComponent {
  private readonly http = inject(HttpClient);
  private readonly api = inject(DietitianDashboardApi);
  private readonly destroyRef = inject(DestroyRef);
  private selectionGeneration = 0;

  readonly menus = signal<DietitianMenu[]>([]);
  readonly patients = signal<DietitianBeneficiary[]>([]);
  readonly recipes = signal<Recipe[]>([]);
  readonly costs = signal<MenuCost[]>([]);
  readonly costsError = signal(false);
  readonly selectedMenuId = signal<number | null>(null);
  readonly detail = signal<MenuDetail | null>(null);
  readonly budget = signal<Budget | null>(null);
  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly busy = signal(false);
  readonly confirmOpen = signal(false);
  readonly editorOpen = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  readonly queue = computed(() => this.menus().filter((item) => ['BROUILLON', 'EN_VALIDATION', 'VALIDE'].includes(item.statut)));
  readonly selectedMenu = computed(() => this.queue().find((item) => item.id === this.selectedMenuId()) ?? null);
  readonly cost = computed(() => this.costs().find((item) => item.menuId === this.selectedMenuId()) ?? null);
  readonly targetPatient = computed(() => {
    const ids = this.detail()?.beneficiaireIds ?? this.selectedMenu()?.beneficiaireIds;
    return ids?.length === 1 ? this.patients().find((item) => item.id === ids[0]) ?? null : null;
  });
  readonly mealViews = computed<MealView[]>(() => {
    const detail = this.detail(), cost = this.cost();
    if (cost?.repas?.length) return cost.repas.map((meal) => ({
      key: String(meal.repasId), title: meal.recetteNom,
      detail: `Jour ${meal.jour} · ${this.label(meal.typeRepas)} · ${meal.nombrePortions} portion(s)`,
      cost: meal.coutTotalEstime,
    }));
    return (detail?.repas ?? []).map((meal, index) => ({
      key: String(meal.id ?? index), title: this.recipes().find((item) => item.id === meal.recetteId)?.nom ?? `Recette n° ${meal.recetteId}`,
      detail: `Jour ${meal.jour} · ${this.label(meal.typeRepas)} · ${meal.nombrePortions} portion(s)`, cost: null,
    }));
  });
  readonly budgetCheck = computed<BudgetCheck>(() => {
    const budget = this.budget(), menu = this.detail(), cost = this.cost();
    if (!budget || !menu || !cost?.prixDisponibles || cost.coutTotalEstime === null || budget.devise !== cost.devise) return 'unknown';
    const period = budget.periode.toUpperCase();
    if (period.includes('JOUR')) {
      if (!cost.repas?.length || cost.repas.some((meal) => meal.coutTotalEstime === null)) return 'unknown';
      const daily = new Map<number, number>();
      for (const meal of cost.repas) daily.set(meal.jour, (daily.get(meal.jour) ?? 0) + meal.coutTotalEstime!);
      return [...daily.values()].every((total) => total <= budget.montant) ? 'respected' : 'exceeded';
    }
    if (!menu.dateDebut || !menu.dateFin) return 'unknown';
    const days = Math.round((new Date(`${menu.dateFin}T12:00:00`).getTime() - new Date(`${menu.dateDebut}T12:00:00`).getTime()) / 86400000) + 1;
    if ((period.includes('SEMAINE') && days === 7) || (period.includes('MOIS') && days >= 28 && days <= 31)) {
      return cost.coutTotalEstime <= budget.montant ? 'respected' : 'exceeded';
    }
    return 'unknown';
  });
  readonly canPublish = computed(() => !!this.detail()?.repas?.length && !!this.cost()?.prixDisponibles && this.budgetCheck() !== 'exceeded');
  readonly canCorrect = computed(() => ['BROUILLON', 'EN_VALIDATION'].includes(this.selectedMenu()?.statut ?? ''));

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.costsError.set(false);
    forkJoin({
      menus: this.api.menus(), patients: this.api.beneficiaries(),
      costs: this.allCosts().pipe(catchError(() => { this.costsError.set(true); return of([] as MenuCost[]); })),
      recipes: this.http.get<ApiPage<Recipe>>(`${API_BASE_URL}/recettes`, { params: new HttpParams().set('size', 200) })
        .pipe(catchError(() => of({ content: [] as Recipe[], number: 0, totalPages: 0 }))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ menus, patients, costs, recipes }) => {
        this.menus.set(menus);
        this.patients.set(patients);
        this.costs.set(costs);
        this.recipes.set(recipes.content);
        this.loading.set(false);
        const current = menus.find((item) => item.id === this.selectedMenuId() && ['BROUILLON', 'EN_VALIDATION', 'VALIDE'].includes(item.statut));
        this.selectMenu(current?.id ?? menus.find((item) => ['BROUILLON', 'EN_VALIDATION', 'VALIDE'].includes(item.statut))?.id ?? null);
      },
      error: (cause: unknown) => { this.loading.set(false); this.error.set(this.describe(cause, 'Impossible de charger la file des menus.')); },
    });
  }
  private allCosts(): Observable<MenuCost[]> {
    const getPage = (page: number) => this.http.get<ApiPage<MenuCost>>(`${API_BASE_URL}/professionnel/menus/couts-estimes`, {
      params: new HttpParams().set('page', page).set('size', 100),
    });
    return getPage(0).pipe(
      expand((result) => result.number + 1 < result.totalPages ? getPage(result.number + 1) : EMPTY),
      reduce((all, result) => all.concat(result.content), [] as MenuCost[]),
    );
  }
  selectMenu(id: number | null): void {
    const generation = ++this.selectionGeneration;
    this.selectedMenuId.set(id);
    this.detail.set(null);
    this.budget.set(null);
    this.confirmOpen.set(false);
    if (!id) { this.detailLoading.set(false); return; }
    this.detailLoading.set(true);
    this.http.get<MenuDetail>(`${API_BASE_URL}/professionnel/menus/${id}`)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (menu) => {
          if (generation !== this.selectionGeneration) return;
          this.detail.set(menu);
          this.detailLoading.set(false);
          const patientId = menu.beneficiaireIds?.length === 1 ? menu.beneficiaireIds[0] : null;
          if (!patientId) return;
          this.http.get<ApiPage<Budget>>(`${API_BASE_URL}/professionnel/beneficiaires/${patientId}/budgets`, {
            params: new HttpParams().set('page', 0).set('size', 100),
          }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (page) => {
              if (generation !== this.selectionGeneration) return;
              this.budget.set(page.content.find((item) => item.id === menu.budgetId) ?? page.content.find((item) => item.actif) ?? null);
            },
          });
        },
        error: (cause: unknown) => {
          if (generation !== this.selectionGeneration) return;
          this.detailLoading.set(false);
          this.error.set(this.describe(cause, 'Impossible de charger le détail du menu.'));
        },
      });
  }
  openConfirm(): void { if (this.canPublish() && !this.busy()) this.confirmOpen.set(true); }
  closeConfirm(): void { if (!this.busy()) this.confirmOpen.set(false); }
  openCorrection(): void { if (!this.canCorrect()) return; this.confirmOpen.set(false); this.editorOpen.set(true); }
  closeCorrection(): void { if (!this.busy()) this.editorOpen.set(false); }
  correctionSaved(): void { this.editorOpen.set(false); this.success.set('Menu corrigé. Vérifiez à nouveau son coût avant publication.'); this.load(); }
  publish(): void {
    const menu = this.selectedMenu();
    if (!menu || !this.canPublish() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const needsValidation = menu.statut !== 'VALIDE';
    const validate: Observable<unknown> = needsValidation
      ? this.http.post(`${API_BASE_URL}/professionnel/menus/${menu.id}/valider`, {})
      : of(null);
    validate.pipe(
      switchMap(() => this.http.post(`${API_BASE_URL}/professionnel/menus/${menu.id}/publier`, {})),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmOpen.set(false);
        this.success.set(`Le menu « ${menu.titre} » est publié.`);
        this.menus.update((items) => items.map((item) => item.id === menu.id ? { ...item, statut: 'PUBLIE' } : item));
        this.selectMenu(this.queue()[0]?.id ?? null);
      },
      error: (cause: unknown) => {
        this.busy.set(false);
        this.confirmOpen.set(false);
        this.error.set(this.describe(cause, 'Validation ou publication impossible. Actualisez la liste avant de réessayer.'));
        this.loadAfterFailure();
      },
    });
  }
  private loadAfterFailure(): void {
    const id = this.selectedMenuId();
    this.api.menus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (menus) => {
        this.menus.set(menus);
        if (id && this.queue().some((item) => item.id === id)) this.selectMenu(id);
      },
    });
  }
  patientName(ids: number[] | null | undefined): string {
    if (!ids?.length) return 'Bénéficiaire non précisé';
    return ids.map((id) => {
      const patient = this.patients().find((item) => item.id === id);
      return patient ? [patient.prenom, patient.nom].filter(Boolean).join(' ') : `Patient n° ${id}`;
    }).join(', ');
  }
  costFor(menuId: number): MenuCost | null { return this.costs().find((item) => item.menuId === menuId) ?? null; }
  label(value: string): string { return value.toLocaleLowerCase('fr').replaceAll('_', ' ').replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('fr')); }
  money(amount: number | null | undefined, currency = 'XOF'): string {
    return amount == null ? 'Prix indisponible' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} ${currency === 'XOF' ? 'FCFA' : currency}`;
  }
  private describe(cause: unknown, fallback: string): string {
    return cause instanceof HttpErrorResponse && typeof cause.error?.message === 'string' ? cause.error.message : fallback;
  }
}
