import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, expand, forkJoin, map, Observable, of, reduce, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';

interface ApiPage<T> { content: T[]; number: number; totalPages: number }
interface Patient { id: number; prenom: string; nom: string; photoProfilUrl?: string | null }
interface Ingredient { id: number; alimentNom: string; quantite: number; unite: string }
interface Recipe { id: number; nom: string; nombrePersonnes: number | null; ingredients?: Ingredient[] | null }
interface PatientProfile { zone: string | null; objectifId: number | null; budgetActifId: number | null }
interface Budget { id: number; montant: number; devise: string; periode: string; actif: boolean }
interface RecipeCost { coutEstime: number; devise: string }
interface CreatedMenu { id: number }
interface MealDraft { key: number; recetteId: number | null; jour: number; typeRepas: string; nombrePortions: number }

const ZONES = ['BAMAKO', 'KAYES', 'KOULIKORO', 'SIKASSO', 'SEGOU', 'MOPTI', 'TOMBOUCTOU', 'GAO', 'KIDAL'];

@Component({
  selector: 'app-dieteticien-create-menu',
  imports: [FormsModule, RouterLink, UiIconComponent],
  templateUrl: './dieteticien-create-menu.component.html',
  styleUrl: './dieteticien-create-menu.component.css',
})
export class DieteticienCreateMenuComponent implements OnInit {
  @ViewChild('menuSettings') menuSettings?: ElementRef<HTMLDetailsElement>;
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private costRequest = 0;
  private nextMealKey = 2;

  readonly zones = ZONES;
  readonly patients = signal<Patient[]>([]);
  readonly recipes = signal<Recipe[]>([]);
  readonly recipeDetails = signal<Record<number, Recipe>>({});
  readonly profile = signal<PatientProfile | null>(null);
  readonly budgets = signal<Budget[]>([]);
  readonly costs = signal<Record<number, number | null>>({});
  readonly loadingPatients = signal(true);
  readonly loadingRecipes = signal(true);
  readonly costsLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly createdMenuId = signal<number | null>(null);
  readonly validatedMenuId = signal<number | null>(null);
  readonly published = signal(false);

  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());
  readonly activeBudget = computed(() => this.budgets().find((item) => item.id === this.selectedBudgetId) ?? null);
  readonly totalCost = computed(() => {
    const selected = this.meals.filter((meal) => meal.recetteId);
    if (!selected.length) return null;
    const costs = this.costs();
    if (selected.some((meal) => costs[meal.key] == null)) return null;
    return selected.reduce((total, meal) => total + (costs[meal.key] ?? 0), 0);
  });

  title = 'Menu personnalisé';
  description = '';
  type = 'PERSONNALISE';
  dateDebut = this.localDate(new Date());
  dateFin = this.localDate(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000));
  zone = '';
  selectedPatientId: number | null = null;
  selectedBudgetId: number | null = null;
  recommendations = '';
  meals: MealDraft[] = [{ key: 1, recetteId: null, jour: 1, typeRepas: 'DEJEUNER', nombrePortions: 1 }];

  ngOnInit(): void {
    this.allPages<Patient>('/professionnel/beneficiaires', 'prenom,asc')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => { this.patients.set(items); this.loadingPatients.set(false); },
        error: () => { this.error.set('Impossible de charger les patients liés à votre compte.'); this.loadingPatients.set(false); },
      });
    this.allPages<Recipe>('/recettes', 'nom,asc')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => { this.recipes.set(items); this.loadingRecipes.set(false); },
        error: () => { this.error.set('Impossible de charger les recettes publiées.'); this.loadingRecipes.set(false); },
      });
  }

  private allPages<T>(path: string, sort: string): Observable<T[]> {
    const getPage = (page: number) => this.http.get<ApiPage<T>>(`${API_BASE_URL}${path}`, {
      params: new HttpParams().set('page', String(page)).set('size', '100').set('sort', sort),
    });
    return getPage(0).pipe(
      expand((result) => result.number + 1 < result.totalPages ? getPage(result.number + 1) : EMPTY),
      reduce((all, result) => all.concat(result.content), [] as T[]),
    );
  }

  onPatientChange(): void {
    ++this.costRequest;
    this.error.set('');
    this.profile.set(null);
    this.budgets.set([]);
    this.selectedBudgetId = null;
    this.zone = '';
    this.costs.set({});
    this.costsLoading.set(false);
    const id = this.selectedPatientId;
    if (!id) return;
    const base = `${API_BASE_URL}/professionnel/beneficiaires/${id}`;
    forkJoin({
      profile: this.http.get<PatientProfile>(`${base}/profil-nutritionnel`),
      budgets: this.http.get<ApiPage<Budget>>(`${base}/budgets`, {
        params: new HttpParams().set('page', '0').set('size', '100'),
      }),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ profile, budgets }) => {
        if (this.selectedPatientId !== id) return;
        this.profile.set(profile);
        this.budgets.set(budgets.content);
        this.zone = profile.zone ?? '';
        this.selectedBudgetId = budgets.content.find((item) => item.id === profile.budgetActifId)?.id
          ?? budgets.content.find((item) => item.actif)?.id ?? null;
        this.refreshCosts();
      },
      error: () => {
        if (this.selectedPatientId === id) {
          this.error.set('Le profil ou le budget du patient est indisponible. Sélectionnez sa zone et vérifiez son dossier.');
        }
      },
    });
  }

  selectedPatient(): Patient | null {
    return this.patients().find((patient) => patient.id === this.selectedPatientId) ?? null;
  }

  hideBrokenImage(event: Event): void {
    (event.target as HTMLImageElement).remove();
  }

  addMeal(): void {
    this.meals.push({ key: this.nextMealKey++, recetteId: null, jour: 1, typeRepas: 'DEJEUNER', nombrePortions: 1 });
  }
  removeMeal(key: number): void {
    if (this.meals.length === 1) return;
    this.meals = this.meals.filter((meal) => meal.key !== key);
    this.refreshCosts();
  }
  changePortions(meal: MealDraft, delta: number): void {
    meal.nombrePortions = Math.max(0.5, Math.round((meal.nombrePortions + delta) * 2) / 2);
    this.refreshCosts();
  }
  onRecipeChange(meal: MealDraft): void {
    const id = meal.recetteId;
    if (id && !this.recipeDetails()[id]) {
      this.http.get<Recipe>(`${API_BASE_URL}/recettes/${id}`)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (recipe) => this.recipeDetails.update((details) => ({ ...details, [id]: recipe })),
          error: () => this.error.set('Les ingrédients de cette recette sont indisponibles pour le moment.'),
        });
    }
    this.refreshCosts();
  }
  recipeFor(id: number | null): Recipe | null {
    return id ? this.recipeDetails()[id] ?? this.recipes().find((item) => item.id === id) ?? null : null;
  }
  ingredientQuantity(ingredient: Ingredient, recipe: Recipe, portions: number): string {
    const amount = ingredient.quantite * portions / Math.max(1, recipe.nombrePersonnes ?? 1);
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(amount)} ${ingredient.unite}`;
  }
  money(amount: number | null | undefined): string {
    return amount == null ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} F CFA`;
  }
  readonly budgetMessage = computed(() => {
    const cost = this.totalCost();
    const budget = this.activeBudget();
    if (cost == null) return 'Sélectionnez une recette et une zone pour afficher un coût estimé.';
    if (!budget) return 'Aucun budget actif lié à ce patient. Le coût reste indicatif.';
    if (budget.devise !== 'XOF') return 'Le budget du patient utilise une autre devise.';
    if (!this.budgetComparable()) return 'Budget affiché pour référence : la période ne correspond pas aux repas saisis.';
    return cost <= budget.montant
      ? 'Les repas saisis restent sous le budget indiqué pour cette période.'
      : 'Les repas saisis dépassent le budget indiqué pour cette période.';
  });

  budgetComparable(): boolean {
    const budget = this.activeBudget();
    if (!budget || budget.devise !== 'XOF' || !this.meals.length) return false;
    const days = this.meals.map((meal) => meal.jour);
    const span = Math.max(...days) - Math.min(...days) + 1;
    const period = budget.periode?.toUpperCase() ?? '';
    return (period.includes('JOUR') && span === 1) ||
      (period.includes('SEMAINE') && span <= 7) ||
      (period.includes('MOIS') && span <= 31);
  }

  overBudget(): boolean {
    const cost = this.totalCost();
    const budget = this.activeBudget();
    return cost !== null && !!budget && this.budgetComparable() && cost > budget.montant;
  }

  refreshCosts(): void {
    const requestId = ++this.costRequest;
    const selected = this.meals.filter((meal) => meal.recetteId != null);
    if (!this.zone || !this.dateDebut || !selected.length) {
      this.costs.set({});
      this.costsLoading.set(false);
      return;
    }
    this.costsLoading.set(true);
    const requests = selected.map((meal) => {
      const recipe = this.recipeFor(meal.recetteId);
      const date = this.mealDate(meal.jour);
      if (!recipe || !date) return of({ key: meal.key, cost: null as number | null });
      return this.http.get<RecipeCost | null>(`${API_BASE_URL}/recettes/${recipe.id}/cout-estime`, {
        params: new HttpParams().set('zone', this.zone).set('date', date),
      }).pipe(
        map((result) => ({
          key: meal.key,
          cost: result?.devise === 'XOF'
            ? result.coutEstime * meal.nombrePortions / Math.max(1, recipe.nombrePersonnes ?? 1)
            : null,
        })),
        catchError(() => of({ key: meal.key, cost: null as number | null })),
      );
    });
    forkJoin(requests).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((results) => {
      if (requestId !== this.costRequest) return;
      this.costs.set(Object.fromEntries(results.map((result) => [result.key, result.cost])));
      this.costsLoading.set(false);
    });
  }

  save(publish: boolean): void {
    if (this.saving() || this.published() || (this.validatedMenuId() !== null && !publish)) return;
    if (!this.title.trim() || !this.dateDebut || !this.zone) this.menuSettings?.nativeElement.setAttribute('open', '');
    if (!this.selectedPatientId || !this.title.trim() || !this.dateDebut || !this.zone ||
      !this.meals.length || this.meals.some((meal) => !meal.recetteId || !Number.isInteger(meal.jour) ||
        meal.jour < 1 || meal.jour > 31 || !Number.isFinite(meal.nombrePortions) || meal.nombrePortions <= 0)) {
      this.error.set('Choisissez un patient et une recette. Vérifiez la zone et la date dans « Paramètres du menu ».');
      return;
    }
    if (this.dateFin && this.dateFin < this.dateDebut) {
      this.menuSettings?.nativeElement.setAttribute('open', '');
      this.error.set('La date de fin doit suivre la date de début.');
      return;
    }
    if (this.dateFin && this.meals.some((meal) => (this.mealDate(meal.jour) ?? '') > this.dateFin)) {
      this.menuSettings?.nativeElement.setAttribute('open', '');
      this.error.set('Un repas se situe après la date de fin du menu.');
      return;
    }
    this.error.set('');
    this.success.set('');
    this.saving.set(true);
    const payload = {
      titre: this.title.trim(),
      description: this.description.trim() || null,
      type: this.type,
      dateDebut: this.dateDebut,
      dateFin: this.dateFin || null,
      zone: this.zone,
      beneficiaireIds: [this.selectedPatientId],
      objectifId: this.profile()?.objectifId ?? null,
      budgetId: this.selectedBudgetId,
      recommandations: this.recommendations.trim() || null,
      repas: this.meals.map((meal) => ({
        recetteId: meal.recetteId, jour: meal.jour, typeRepas: meal.typeRepas,
        nombrePortions: meal.nombrePortions,
      })),
    };
    const existing = this.createdMenuId();
    const initial: Observable<CreatedMenu> = existing
      ? this.validatedMenuId() === existing
        ? of({ id: existing })
        : this.http.put<CreatedMenu | null>(`${API_BASE_URL}/professionnel/menus/${existing}`, payload)
          .pipe(map((menu) => menu ?? { id: existing }))
      : this.http.post<CreatedMenu>(`${API_BASE_URL}/professionnel/menus`, payload);
    initial.pipe(
      switchMap((menu) => {
        this.createdMenuId.set(menu.id);
        if (!publish) return of(menu);
        const validation = this.validatedMenuId() === menu.id
          ? of(menu)
          : this.http.post<CreatedMenu | null>(`${API_BASE_URL}/professionnel/menus/${menu.id}/valider`, {}).pipe(
            tap(() => this.validatedMenuId.set(menu.id)),
          );
        return validation.pipe(
          switchMap(() => this.http.post<CreatedMenu | null>(`${API_BASE_URL}/professionnel/menus/${menu.id}/publier`, {})
            .pipe(map((published) => published ?? menu))),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (menu) => {
        this.saving.set(false);
        if (publish) this.published.set(true);
        this.success.set(publish
          ? `Menu n° ${menu.id} publié. Vous pouvez le retrouver dans « Mes menus ».`
          : `Brouillon n° ${menu.id} enregistré. Vous pouvez le valider et le publier.`);
      },
      error: (cause: unknown) => {
        this.saving.set(false);
        const detail = cause instanceof HttpErrorResponse && typeof cause.error?.message === 'string'
          ? cause.error.message : 'Vérifiez les champs et réessayez.';
        this.error.set(this.createdMenuId()
          ? `Brouillon n° ${this.createdMenuId()} conservé, mais la validation ou la publication a échoué : ${detail}`
          : `Création impossible : ${detail}`);
      },
    });
  }

  private mealDate(day: number): string | null {
    const date = new Date(`${this.dateDebut}T12:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    date.setDate(date.getDate() + day - 1);
    return this.localDate(date);
  }
  private localDate(date: Date): string {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
}
