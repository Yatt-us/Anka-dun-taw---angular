import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { catchError, map, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';

interface ApiPage<T> { content: T[]; totalElements: number; totalPages: number }
interface MealCost {
  repasId: number; recetteNom: string; jour: number; typeRepas: string; nombrePortions: number;
  dateEstimation: string | null; coutRecetteReference: number | null;
  coutParPortion: number | null; coutTotalEstime: number | null; prixDisponible: boolean;
}
interface MenuCost {
  menuId: number; titre: string; statut: string; zone: string | null; dateDebut: string | null;
  dateFin: string | null; devise: string; coutTotalEstime: number | null;
  prixDisponibles: boolean; repas: MealCost[];
}
interface MenuDetail { beneficiaireIds?: number[] | null; budgetId?: number | null }
interface Budget { id: number; montant: number; devise: string; periode: string; actif: boolean }

@Component({
  selector: 'app-portions-couts',
  standalone: true,
  imports: [RouterLink, UiIconComponent],
  templateUrl: './portions-couts.component.html',
  styleUrl: './portions-couts.component.css',
})
export class PortionsCoutsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private budgetRequest = 0;
  readonly menus = signal<MenuCost[]>([]);
  readonly selectedMenuId = signal<number | null>(null);
  readonly portions = signal<Record<number, number>>({});
  readonly budget = signal<Budget | null>(null);
  readonly budgetLoading = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(0);
  readonly totalMenus = signal(0);
  readonly totalPages = signal(0);
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  private readonly pageSize = 10;
  readonly selectedMenu = computed(() => this.menus().find((item) => item.menuId === this.selectedMenuId()) ?? this.menus()[0] ?? null);
  readonly simulatedTotal = computed(() => {
    const menu = this.selectedMenu();
    if (!menu?.repas.length || menu.repas.some((meal) => meal.coutParPortion === null)) return null;
    return menu.repas.reduce((total, meal) => total + (meal.coutParPortion ?? 0) * this.portionCount(meal), 0);
  });
  readonly difference = computed(() => {
    const original = this.selectedMenu()?.coutTotalEstime;
    const simulated = this.simulatedTotal();
    return original == null || simulated == null ? null : simulated - original;
  });
  readonly hasChanges = computed(() => Object.keys(this.portions()).length > 0);
  readonly comparableBudget = computed(() => {
    const budget = this.budget();
    const menu = this.selectedMenu();
    if (!budget || !menu?.dateDebut || !menu.dateFin || !menu.repas.length || budget.devise !== menu.devise) return false;
    const days = Math.round((new Date(`${menu.dateFin}T12:00:00`).getTime() - new Date(`${menu.dateDebut}T12:00:00`).getTime()) / 86400000) + 1;
    const period = budget.periode.toUpperCase();
    return (period.includes('JOUR') && days === 1) || (period.includes('SEMAINE') && days === 7) ||
      (period.includes('MOIS') && days >= 28 && days <= 31);
  });
  readonly budgetDifference = computed(() => {
    const total = this.simulatedTotal();
    return this.comparableBudget() && total !== null ? this.budget()!.montant - total : null;
  });

  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new HttpParams().set('page', this.page()).set('size', this.pageSize).set('sort', 'dateDebut,desc');
    this.http.get<ApiPage<MenuCost>>(`${API_BASE_URL}/professionnel/menus/couts-estimes`, { params }).subscribe({
      next: (result) => {
        this.menus.set(result.content);
        this.totalMenus.set(result.totalElements);
        this.totalPages.set(result.totalPages);
        if (!result.content.some((item) => item.menuId === this.selectedMenuId())) this.selectMenu(result.content[0]?.menuId ?? null);
        this.loading.set(false);
      },
      error: (cause: unknown) => {
        this.error.set(cause instanceof HttpErrorResponse && cause.status === 403
          ? 'Votre compte doit être un diététicien vérifié pour consulter les coûts des menus.'
          : 'Le calcul des coûts est indisponible. Vérifiez votre connexion puis réessayez.');
        this.loading.set(false);
      },
    });
  }
  selectMenu(id: number | null): void {
    this.selectedMenuId.set(id);
    this.portions.set({});
    this.loadBudget(id);
  }
  private loadBudget(id: number | null): void {
    const request = ++this.budgetRequest;
    this.budget.set(null);
    if (!id) return;
    this.budgetLoading.set(true);
    this.http.get<MenuDetail>(`${API_BASE_URL}/professionnel/menus/${id}`).pipe(
      switchMap((detail) => {
        const patientId = detail.beneficiaireIds?.length === 1 ? detail.beneficiaireIds[0] : null;
        if (!patientId) return of(null);
        return this.http.get<ApiPage<Budget>>(`${API_BASE_URL}/professionnel/beneficiaires/${patientId}/budgets`, {
          params: new HttpParams().set('page', 0).set('size', 100),
        }).pipe(map((page) => page.content.find((item) => item.id === detail.budgetId) ?? page.content.find((item) => item.actif) ?? null));
      }),
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((budget) => {
      if (request !== this.budgetRequest) return;
      this.budget.set(budget);
      this.budgetLoading.set(false);
    });
  }
  onMenuChange(event: Event): void { this.selectMenu(Number((event.target as HTMLSelectElement).value)); }
  portionCount(meal: MealCost): number { return this.portions()[meal.repasId] ?? meal.nombrePortions; }
  changePortions(meal: MealCost, delta: number): void {
    const next = Math.max(0.5, Math.round((this.portionCount(meal) + delta) * 2) / 2);
    this.portions.update((values) => ({ ...values, [meal.repasId]: next }));
  }
  resetPortions(): void { this.portions.set({}); }
  mealTotal(meal: MealCost): number | null { return meal.coutParPortion === null ? null : meal.coutParPortion * this.portionCount(meal); }
  changePage(delta: number): void { this.page.update((current) => Math.max(0, current + delta)); this.load(); }
  money(amount: number | null | undefined, currency: string): string {
    return amount == null ? 'Prix indisponible' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} ${currency === 'XOF' ? 'FCFA' : currency || 'FCFA'}`;
  }
  dateRange(start: string | null, end: string | null): string {
    if (!start) return 'Période non définie';
    if (!end || end === start) return new Date(`${start}T00:00:00`).toLocaleDateString('fr-FR');
    return `${new Date(`${start}T00:00:00`).toLocaleDateString('fr-FR')} – ${new Date(`${end}T00:00:00`).toLocaleDateString('fr-FR')}`;
  }
  label(value: string): string { return value.toLocaleLowerCase('fr').replaceAll('_', ' ').replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('fr')); }
}
