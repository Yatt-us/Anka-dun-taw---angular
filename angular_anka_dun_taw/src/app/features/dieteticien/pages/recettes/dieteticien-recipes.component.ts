import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, Subscription, catchError, expand, from, map, mergeMap, Observable, of, reduce } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';

interface ApiPage<T> { content: T[]; number: number; totalPages: number }
interface Ingredient { alimentNom: string }
interface Recipe {
  id: number; nom: string; description?: string | null; imageUrl?: string | null;
  dureePreparationMinutes?: number | null; nombrePersonnes?: number | null;
  ingredients?: Ingredient[] | null;
}
interface RecipeCost { coutEstime: number; devise: string }
interface RecipeView extends Recipe { cost: number | null; currency: string; detailsLoaded: boolean }

@Component({
  selector: 'app-dieteticien-recipes',
  imports: [RouterLink, UiIconComponent],
  templateUrl: './dieteticien-recipes.component.html',
  styleUrl: './dieteticien-recipes.component.css',
})
export class DieteticienRecipesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private enrichSubscription?: Subscription;
  readonly recipes = signal<RecipeView[]>([]);
  readonly loading = signal(true);
  readonly enriching = signal(false);
  readonly error = signal('');
  readonly query = signal('');
  readonly maxCost = signal(false);
  readonly page = signal(0);
  readonly selected = signal<RecipeView | null>(null);
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  readonly zone = 'BAMAKO';
  readonly filtered = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('fr');
    return this.recipes().filter((recipe) => {
      if (this.maxCost() && (recipe.currency !== 'XOF' || recipe.cost === null || recipe.cost >= 500)) return false;
      if (!query) return true;
      return [recipe.nom, recipe.description ?? '', ...(recipe.ingredients ?? []).map((item) => item.alimentNom)]
        .some((part) => part.toLocaleLowerCase('fr').includes(query));
    });
  });
  readonly visible = computed(() => this.filtered().slice(this.page() * 8, (this.page() + 1) * 8));
  readonly featured = computed(() => this.filtered().slice(0, 3));
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / 8)));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.enrichSubscription?.unsubscribe();
    this.loading.set(true);
    this.enriching.set(false);
    this.error.set('');
    const getPage = (page: number): Observable<ApiPage<Recipe>> => this.http.get<ApiPage<Recipe>>(`${API_BASE_URL}/recettes`, {
      params: new HttpParams().set('page', page).set('size', 100).set('sort', 'nom,asc'),
    });
    getPage(0).pipe(
      expand((result) => result.number + 1 < result.totalPages ? getPage(result.number + 1) : EMPTY),
      reduce((all, result) => all.concat(result.content), [] as Recipe[]),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (items) => {
        items.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
        this.recipes.set(items.map((item) => ({ ...item, cost: null, currency: 'XOF', detailsLoaded: false })));
        this.page.set(0);
        this.loading.set(false);
        this.enriching.set(items.length > 0);
        this.enrichSubscription = from(items).pipe(mergeMap((recipe) => this.enrich(recipe), 5), takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (detail) => this.recipes.update((current) => current.map((item) => item.id === detail.id ? detail : item)),
          complete: () => this.enriching.set(false),
        });
      },
      error: () => { this.error.set('Impossible de charger le catalogue des recettes.'); this.loading.set(false); },
    });
  }

  private enrich(recipe: Recipe): Observable<RecipeView> {
    return this.http.get<Recipe>(`${API_BASE_URL}/recettes/${recipe.id}`).pipe(
      catchError(() => of(recipe)),
      mergeMap((detail) => this.http.get<RecipeCost | null>(`${API_BASE_URL}/recettes/${recipe.id}/cout-estime`, {
        params: new HttpParams().set('zone', this.zone).set('date', this.localDate()),
      }).pipe(
        map((cost) => ({ ...recipe, ...detail,
          cost: cost?.coutEstime != null && (detail.nombrePersonnes ?? 0) > 0 ? cost.coutEstime / detail.nombrePersonnes! : null,
          currency: cost?.devise ?? 'XOF', detailsLoaded: !!detail.ingredients })),
        catchError(() => of({ ...recipe, ...detail, cost: null, currency: 'XOF', detailsLoaded: !!detail.ingredients })),
      )),
    );
  }
  private localDate(): string {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  search(event: Event): void { this.query.set((event.target as HTMLInputElement).value); this.page.set(0); }
  toggleCost(): void { this.maxCost.update((value) => !value); this.page.set(0); }
  changePage(delta: number): void { this.page.update((value) => Math.max(0, Math.min(this.totalPages() - 1, value + delta))); }
  money(cost: number | null, currency: string): string {
    return cost === null ? 'Prix indisponible' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(cost)} ${currency === 'XOF' ? 'FCFA' : currency}`;
  }
  ingredients(recipe: Recipe): string {
    return recipe.ingredients?.length ? recipe.ingredients.map((item) => item.alimentNom).join(', ') : 'Ingrédients non renseignés';
  }
  hideBrokenImage(event: Event): void { (event.target as HTMLImageElement).hidden = true; }
}
