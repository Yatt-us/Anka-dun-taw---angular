import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { zoneLabel } from '../../../../shared/data-access/zones.data-access';
import { Budget, CreatedMenu, DieteticienMenuDataAccess, Ingredient, Patient, PatientProfile, Recipe } from '../../data-access/dieteticien-menu.data-access';

interface MealDraft { key: number; recetteId: number | null; jour: number; typeRepas: string; nombrePortions: number }
interface BudgetLine { date: string; cost: number | null; limit: number | null }

@Component({
  selector: 'app-dieteticien-create-menu',
  imports: [FormsModule, RouterLink, UiIconComponent],
  templateUrl: './dieteticien-create-menu.component.html',
  styleUrl: './dieteticien-create-menu.component.css',
})
export class DieteticienCreateMenuComponent implements OnInit {
  private readonly menusApi = inject(DieteticienMenuDataAccess);
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
    this.menusApi.patients()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => { this.patients.set(items); this.loadingPatients.set(false); },
        error: () => { this.error.set('Impossible de charger les patients liés à votre compte.'); this.loadingPatients.set(false); },
      });
    this.menusApi.recipes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => { this.recipes.set(items); this.loadingRecipes.set(false); },
        error: () => { this.error.set('Impossible de charger les recettes publiées.'); this.loadingRecipes.set(false); },
      });
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
    this.menusApi.patientContext(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
      this.menusApi.recipe(id)
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
  budgetPeriodName(period: string): string {
    return { JOUR: 'jour', SEMAINE: 'semaine', MOIS: 'mois' }[period] ?? 'période';
  }
  /** Le backend exige un budget actif pour chaque date de repas publiée. */
  budgetValidityError(): string | null {
    const budget = this.activeBudget();
    if (this.profile()?.modeBudget !== 'AVEC_BUDGET' || !budget) return null;
    for (const meal of this.meals.filter((item) => item.recetteId)) {
      const date = this.mealDate(meal.jour);
      if (date && ((budget.dateDebut && date < budget.dateDebut) ||
        (budget.dateFin && date > budget.dateFin))) {
        return `Le budget actif du patient ne couvre pas le repas du ${date}. Modifiez les dates du menu ou demandez au patient d'actualiser son budget.`;
      }
    }
    return null;
  }
  budgetMessage(): string {
    const mode = this.profile()?.modeBudget;
    if (!this.selectedPatientId) return 'Choisissez un patient pour charger le budget de son profil actif.';
    if (!this.profile()) return 'Chargement du profil nutritionnel actif du patient…';
    if (mode === 'SANS_BUDGET') return 'Ce profil ne définit pas de budget. Le coût estimé reste visible, sans plafond à comparer.';
    if (mode === 'AVEC_BUDGET' && !this.activeBudget()) return 'Le budget actif du profil est introuvable. Demandez au patient de le vérifier.';
    if (mode === 'AVEC_BUDGET' && this.activeBudget()?.devise !== 'XOF') return 'Le budget du patient doit être exprimé en FCFA.';
    if (this.budgetValidityError()) return this.budgetValidityError()!;
    if (mode === 'PETIT_BUDGET' && this.dailyBudgetsLoading()) return 'Chargement des montants disponibles pour les jours du menu…';
    if (!this.meals.some((meal) => meal.recetteId)) return 'Choisissez une recette pour comparer son prix au budget du patient.';
    if (this.costsLoading() || this.totalCost() === null) return 'Le coût d’au moins un repas est inconnu pour cette région et cette date. Vérifiez les prix des ingrédients.';
    if (!this.budgetComparable()) return mode === 'PETIT_BUDGET'
      ? 'Le patient doit renseigner son montant disponible pour chaque jour du menu.'
      : 'Le budget ne peut pas être comparé aux repas saisis.';
    return this.overBudget()
      ? 'Le coût dépasse le budget du profil actif. Réduisez les portions ou choisissez des recettes moins chères.'
      : 'Les repas saisis respectent le budget affiché. La validation tiendra aussi compte des autres menus publiés.';
  }

  budgetComparable(): boolean {
    if (this.totalCost() === null || this.budgetValidityError()) return false;
    const lines = this.budgetLines();
    if (!lines.length || lines.some((line) => line.cost === null || line.limit === null)) return false;
    if (this.profile()?.modeBudget === 'PETIT_BUDGET') return !this.dailyBudgetsLoading();
    const budget = this.activeBudget();
    return !!budget && budget.devise === 'XOF' && ['JOUR', 'SEMAINE', 'MOIS'].includes(budget.periode);
  }

  overBudget(): boolean {
    return this.budgetComparable() && this.budgetLines().some((line) =>
      line.cost !== null && line.limit !== null && line.cost > line.limit);
  }

  /** Compare les repas par période du profil ; un prix inconnu reste visible comme tel. */
  budgetLines(): BudgetLine[] {
    const mode = this.profile()?.modeBudget;
    const budget = this.activeBudget();
    if (mode !== 'PETIT_BUDGET' && !budget) return [];
    const lines = new Map<string, BudgetLine>();
    for (const meal of this.meals.filter((item) => item.recetteId)) {
      const date = this.mealDate(meal.jour);
      if (!date) continue;
      const period = mode === 'PETIT_BUDGET' ? 'JOUR' : budget!.periode;
      const key = this.periodStart(date, period);
      const available = this.dailyBudgets()[date] ?? null;
      // Le mode petit budget applique le plus petit des deux plafonds : jour et profil.
      const ceiling = this.profile()?.plafondPetitBudget;
      const limit = mode === 'PETIT_BUDGET'
        ? available === null ? null : ceiling == null ? available : Math.min(available, ceiling)
        : budget!.montant;
      const cost = this.costs()[meal.key] ?? null;
      const line = lines.get(key);
      lines.set(key, { date: key, limit,
        cost: cost === null || line?.cost === null ? null : (line?.cost ?? 0) + cost,
      });
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
    forkJoin(dates.map((date) => this.menusApi.dailyBudget(patientId, date).pipe(
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
      return this.menusApi.recipeCost(recipe.id, this.zone, date).pipe(
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
    const validationError = this.saveValidationError(publish);
    if (validationError) {
      this.error.set(validationError);
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
        : this.menusApi.update(existing, payload)
      : this.menusApi.create(payload);
    let phase: 'enregistrement' | 'validation' | 'publication' = 'enregistrement';
    initial.pipe(
      switchMap((menu) => {
        this.createdMenuId.set(menu.id);
        if (!publish) return of(menu);
        phase = 'validation';
        const validation = this.validatedMenuId() === menu.id
          ? of(menu)
          : this.menusApi.validate(menu.id).pipe(
            tap(() => this.validatedMenuId.set(menu.id)),
          );
        return validation.pipe(switchMap(() => {
          phase = 'publication';
          return this.menusApi.publish(menu.id)
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

  private saveValidationError(publish: boolean): string | null {
    if (!this.selectedPatientId || !this.profile() || !this.title.trim() || !this.dateDebut || !this.zone ||
      !this.meals.length || this.meals.some((meal) => !meal.recetteId || !Number.isInteger(meal.jour) ||
        meal.jour < 1 || meal.jour > 31 || !Number.isFinite(meal.nombrePortions) || meal.nombrePortions <= 0)) {
      return 'Complétez les champs obligatoires : nom du menu, patient, région, date de début, recette et jour de chaque repas. Attendez le chargement du profil du patient.';
    }
    if (this.dateFin && this.dateFin < this.dateDebut) {
      return 'La date de fin doit suivre la date de début.';
    }
    if (this.dateFin && this.meals.some((meal) => (this.mealDate(meal.jour) ?? '') > this.dateFin)) {
      return 'Un repas tombe après la date de fin. Augmentez la période ou corrigez le jour du repas.';
    }
    const modeBudget = this.profile()?.modeBudget;
    const prixObligatoires = this.type === 'PETIT_BUDGET' || modeBudget === 'AVEC_BUDGET';
    if (publish && modeBudget === 'AVEC_BUDGET' && !this.selectedBudgetId) {
      return 'Publication impossible : ce patient est en mode « Avec budget », mais aucun budget actif n’est sélectionné. Vérifiez son budget dans son profil.';
    }
    if (publish && this.budgetValidityError()) return this.budgetValidityError();
    if (publish && modeBudget === 'AVEC_BUDGET' && this.activeBudget()?.devise !== 'XOF') {
      return 'Publication impossible : le budget actif du patient doit être exprimé en FCFA.';
    }
    if (publish && prixObligatoires && (this.costsLoading() || this.meals.some((meal) =>
      meal.recetteId != null && this.costs()[meal.key] == null))) {
      return 'Publication impossible : le coût d’au moins un repas n’est pas vérifiable pour la région et la date choisies. Vérifiez les prix des ingrédients, la région et la saison, puis réessayez.';
    }
    if (publish && modeBudget === 'PETIT_BUDGET' && !this.budgetComparable()) {
      return 'Publication impossible : le patient doit renseigner son budget disponible pour chaque jour du menu.';
    }
    if (publish && this.overBudget()) {
      return 'Publication impossible : le coût estimé dépasse le budget du profil actif. Adaptez les recettes ou les portions.';
    }
    return null;
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
