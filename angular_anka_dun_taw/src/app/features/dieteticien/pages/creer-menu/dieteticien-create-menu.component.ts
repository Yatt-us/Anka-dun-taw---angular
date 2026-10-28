import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, expand, forkJoin, map, Observable, of, reduce, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { zoneLabel } from '../../../../shared/data-access/zones.data-access';

interface ApiPage<T> { content: T[]; number: number; totalPages: number }
interface Patient { id: number; prenom: string; nom: string; photoProfilUrl?: string | null }
interface Ingredient { id: number; alimentNom: string; quantite: number; unite: string }
interface Recipe { id: number; nom: string; nombrePersonnes: number | null; ingredients?: Ingredient[] | null }
interface PatientProfile { nom: string | null; zone: string | null; objectifId: number | null; budgetActifId: number | null; modeBudget: string | null }
interface Budget { id: number; montant: number; devise: string; periode: string; actif: boolean }
interface DailyBudget { montantDisponible: number }
interface RecipeCost { coutEstime: number; devise: string }
interface CreatedMenu { id: number }
interface MealDraft { key: number; recetteId: number | null; jour: number; typeRepas: string; nombrePortions: number }

  @Component({
  selector: 'app-dieteticien-create-menu',
  imports: [FormsModule, RouterLink, UiIconComponent],
  templateUrl: './dieteticien-create-menu.component.html',
  styleUrl: './dieteticien-create-menu.component.css',
})
export class DieteticienCreateMenuComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private costRequest = 0;
  private dailyBudgetRequest = 0;
  private nextMealKey = 2;

  readonly patients = signal<Patient[]>([]);
  readonly recipes = signal<Recipe[]>([]);
  readonly recipeDetails = signal<Record<number, Recipe>>({});
  readonly profile = signal<PatientProfile | null>(null);
  readonly budgets = signal<Budget[]>([]);
  readonly dailyBudgets = signal<Record<string, number | null>>({});
  readonly dailyBudgetsLoading = signal(false);
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
  readonly activeBudget = computed(() => {
    const id = this.profile()?.budgetActifId;
    return this.budgets().find((item) => item.id === id && item.actif) ?? null;
  });
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
    ++this.dailyBudgetRequest;
    this.error.set('');
    this.profile.set(null);
    this.budgets.set([]);
    this.dailyBudgets.set({});
    this.dailyBudgetsLoading.set(false);
    this.selectedBudgetId = null;
    this.zone = '';
    this.type = 'PERSONNALISE';
    this.costs.set({});
    this.costsLoading.set(false);
    const id = this.selectedPatientId;
    if (!id) return;
    const base = `${API_BASE_URL}/professionnel/beneficiaires/${id}`;
    forkJoin({
      profile: this.http.get<PatientProfile>(`${base}/profil-nutritionnel`),
      budgets: this.allPages<Budget>(`/professionnel/beneficiaires/${id}/budgets`, 'dateDebut,desc'),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ profile, budgets }) => {
        if (this.selectedPatientId !== id) return;
        this.profile.set(profile);
        this.budgets.set(budgets);
        this.zone = profile.zone ?? '';
        // Le type du menu suit le mode du profil pour éviter le conflit de validation côté API.
        this.type = profile.modeBudget === 'PETIT_BUDGET' ? 'PETIT_BUDGET' : 'PERSONNALISE';
        this.selectedBudgetId = profile.modeBudget === 'AVEC_BUDGET'
          ? budgets.find((item) => item.id === profile.budgetActifId && item.actif)?.id ?? null
          : null;
        if (profile.modeBudget === 'AVEC_BUDGET' && !this.selectedBudgetId) {
          this.error.set('Le profil actif du patient indique un budget, mais son budget actif est introuvable. Demandez au patient de le vérifier.');
        }
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

  zoneName(): string {
    return this.zone ? zoneLabel(this.zone) : 'Région à renseigner';
  }

  hideBrokenImage(event: Event): void {
    (event.target as HTMLImageElement).remove();
  }

  addMeal(): void {
    this.meals.push({ key: this.nextMealKey++, recetteId: null, jour: 1, typeRepas: 'DEJEUNER', nombrePortions: 1 });
    this.refreshCosts();
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
    return amount == null ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} FCFA`;
  }
  budgetMessage(): string {
    const cost = this.totalCost();
    const budget = this.activeBudget();
    if (cost == null) return 'Sélectionnez une recette et une zone pour afficher un coût estimé.';
    if (this.profile()?.modeBudget === 'PETIT_BUDGET') {
      if (this.dailyBudgetsLoading()) return 'Chargement des montants disponibles pour les jours du menu…';
      if (!this.budgetComparable()) return 'Le patient doit renseigner son montant disponible pour chaque jour du menu.';
      return this.overBudget()
        ? 'Un ou plusieurs jours dépassent le montant disponible. Réduisez les portions ou choisissez des recettes moins chères.'
        : 'Les repas saisis respectent les montants quotidiens connus. La validation tiendra compte des autres menus publiés.';
    }
    if (!budget) return 'Aucun budget actif lié au profil actuel du patient. Vérifiez son dossier avant publication.';
    // L'API utilise XOF ; l'interface affiche son libellé usuel FCFA.
    if (budget.devise !== 'XOF') return 'Le budget du patient utilise une autre devise.';
    if (!this.budgetComparable()) return 'Le budget ne peut pas être comparé aux repas saisis.';
    return this.overBudget()
      ? 'Au moins une période dépasse le budget du profil actif. Adaptez les recettes ou les portions.'
      : 'Les repas saisis respectent le budget par période. La validation tiendra compte des autres menus publiés.';
  }

  budgetComparable(): boolean {
    if (this.totalCost() === null) return false;
    if (this.profile()?.modeBudget === 'PETIT_BUDGET') {
      return !this.dailyBudgetsLoading() && this.budgetLines().every((line) => line.limit !== null);
    }
    const budget = this.activeBudget();
    return !!budget && budget.devise === 'XOF' && ['JOUR', 'SEMAINE', 'MOIS'].includes(budget.periode);
  }

  overBudget(): boolean {
    return this.budgetComparable() && this.budgetLines().some((line) => line.limit !== null && line.cost > line.limit);
  }

  /** Regroupe les repas par période réelle du budget, comme le contrôle backend. */
  budgetLines(): Array<{ date: string; cost: number; limit: number | null }> {
    const mode = this.profile()?.modeBudget;
    const budget = this.activeBudget();
    if (mode !== 'PETIT_BUDGET' && !budget) return [];
    const lines = new Map<string, { date: string; cost: number; limit: number | null }>();
    for (const meal of this.meals.filter((item) => item.recetteId)) {
      const date = this.mealDate(meal.jour);
      const cost = this.costs()[meal.key];
      if (!date || cost == null) continue;
      const period = mode === 'PETIT_BUDGET' ? 'JOUR' : budget!.periode;
      const key = this.periodStart(date, period);
      const limit = mode === 'PETIT_BUDGET' ? this.dailyBudgets()[date] ?? null : budget!.montant;
      const line = lines.get(key) ?? { date: key, cost: 0, limit };
      line.cost += cost;
      lines.set(key, line);
    }
    return [...lines.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private periodStart(dateValue: string, period: string): string {
    const date = new Date(`${dateValue}T12:00:00`);
    if (period === 'SEMAINE') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    if (period === 'MOIS') date.setDate(1);
    return this.localDate(date);
  }

  private refreshDailyBudgets(): void {
    const requestId = ++this.dailyBudgetRequest;
    this.dailyBudgets.set({});
    const patientId = this.selectedPatientId;
    if (!patientId || this.profile()?.modeBudget !== 'PETIT_BUDGET' || !this.dateDebut) {
      this.dailyBudgetsLoading.set(false);
      return;
    }
    const dates = [...new Set(this.meals.map((meal) => this.mealDate(meal.jour)).filter((date): date is string => !!date))];
    if (!dates.length) {
      this.dailyBudgetsLoading.set(false);
      return;
    }
    this.dailyBudgetsLoading.set(true);
    forkJoin(dates.map((date) => this.http.get<DailyBudget>(
      `${API_BASE_URL}/professionnel/beneficiaires/${patientId}/petit-budget/jours/${date}`,
    ).pipe(
      map((result) => ({ date, amount: result.montantDisponible as number | null })),
      catchError(() => of({ date, amount: null as number | null })),
    ))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((results) => {
      if (requestId !== this.dailyBudgetRequest || patientId !== this.selectedPatientId) return;
      this.dailyBudgets.set(Object.fromEntries(results.map((result) => [result.date, result.amount])));
      this.dailyBudgetsLoading.set(false);
    });
  }

  refreshCosts(): void {
    const requestId = ++this.costRequest;
    this.refreshDailyBudgets();
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
    if (!this.selectedPatientId || !this.profile() || !this.title.trim() || !this.dateDebut || !this.zone ||
      !this.meals.length || this.meals.some((meal) => !meal.recetteId || !Number.isInteger(meal.jour) ||
        meal.jour < 1 || meal.jour > 31 || !Number.isFinite(meal.nombrePortions) || meal.nombrePortions <= 0)) {
      this.error.set('Complétez les champs obligatoires : nom du menu, patient, région, date de début, recette et jour de chaque repas. Attendez le chargement du profil du patient.');
      return;
    }
    if (this.dateFin && this.dateFin < this.dateDebut) {
      this.error.set('La date de fin doit suivre la date de début.');
      return;
    }
    if (this.dateFin && this.meals.some((meal) => (this.mealDate(meal.jour) ?? '') > this.dateFin)) {
      this.error.set('Un repas tombe après la date de fin. Augmentez la période ou corrigez le jour du repas.');
      return;
    }
    const modeBudget = this.profile()?.modeBudget;
    const prixObligatoires = this.type === 'PETIT_BUDGET' || modeBudget === 'AVEC_BUDGET';
    if (publish && modeBudget === 'AVEC_BUDGET' && !this.selectedBudgetId) {
      this.error.set('Publication impossible : ce patient est en mode « Avec budget », mais aucun budget actif n’est sélectionné. Vérifiez son budget dans son profil.');
      return;
    }
    if (publish && prixObligatoires && (this.costsLoading() || this.meals.some((meal) =>
      meal.recetteId != null && this.costs()[meal.key] == null))) {
      this.error.set('Publication impossible : le coût d’au moins un repas n’est pas vérifiable pour la région et la date choisies. Vérifiez les prix des ingrédients, la région et la saison, puis réessayez.');
      return;
    }
    if (publish && modeBudget === 'PETIT_BUDGET' && !this.budgetComparable()) {
      this.error.set('Publication impossible : le patient doit renseigner son budget disponible pour chaque jour du menu.');
      return;
    }
    if (publish && this.overBudget()) {
      this.error.set('Publication impossible : le coût estimé dépasse le budget du profil actif. Adaptez les recettes ou les portions.');
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
    let phase: 'enregistrement' | 'validation' | 'publication' = 'enregistrement';
    initial.pipe(
      switchMap((menu) => {
        this.createdMenuId.set(menu.id);
        if (!publish) return of(menu);
        phase = 'validation';
        const validation = this.validatedMenuId() === menu.id
          ? of(menu)
          : this.http.post<CreatedMenu | null>(`${API_BASE_URL}/professionnel/menus/${menu.id}/valider`, {}).pipe(
            tap(() => this.validatedMenuId.set(menu.id)),
          );
        return validation.pipe(switchMap(() => {
          phase = 'publication';
          return this.http.post<CreatedMenu | null>(`${API_BASE_URL}/professionnel/menus/${menu.id}/publier`, {})
            .pipe(map((published) => published ?? menu));
        }));
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
        const detail = this.errorDetail(cause);
        if (!this.createdMenuId()) {
          this.error.set(`Création impossible : ${detail}`);
          return;
        }
        const etape = phase === 'validation' ? 'validation' : phase === 'publication' ? 'publication' : 'enregistrement';
        this.error.set(`Brouillon n° ${this.createdMenuId()} conservé, mais l’étape de ${etape} a échoué : ${detail}`);
      },
    });
  }

  /** Lit les formats d’erreur Spring et proxy sans remplacer le vrai motif par un message générique. */
  private errorDetail(cause: unknown): string {
    if (!(cause instanceof HttpErrorResponse)) {
      return cause instanceof Error && cause.message ? cause.message : 'Erreur inattendue. Réessayez.';
    }
    if (cause.status === 0) return 'Le serveur est injoignable. Vérifiez la connexion puis réessayez.';
    const body: unknown = cause.error;
    if (typeof body === 'string' && body.trim()) return body.trim();
    if (body && typeof body === 'object') {
      const response = body as Record<string, unknown>;
      for (const key of ['message', 'detail', 'erreur', 'error', 'title']) {
        const value = response[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      const violations = response['errors'] ?? response['violations'];
      if (Array.isArray(violations)) {
        const messages = violations.map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const detail = (item as Record<string, unknown>)['message'] ??
              (item as Record<string, unknown>)['defaultMessage'];
            return typeof detail === 'string' ? detail : '';
          }
          return '';
        }).filter(Boolean);
        if (messages.length) return messages.join(' · ');
      }
    }
    return `Le serveur a refusé l’opération (HTTP ${cause.status}). Vérifiez les données du patient, les recettes et leurs prix, puis réessayez.`;
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
