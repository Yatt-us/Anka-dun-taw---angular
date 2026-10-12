import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, from, map, mergeMap, of, toArray } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { DietitianBeneficiary, DietitianDashboardApi } from '../../data-access/dieteticien-dashboard.data-access';

interface ApiPage<T> { content: T[] }
interface Goal {
  id: number; type: string; description?: string | null;
  statut: string; progressionPourcentage?: number | null;
}
interface Budget { id: number; montant: number; devise?: string; periode?: string; actif: boolean }
interface PatientDetails { goals: Goal[] | null; budgets: Budget[] | null }
interface ProgressBar { label: string; value: number; count: number; color: string }

@Component({
  selector: 'app-dieteticien-tracking',
  imports: [RouterLink, UiIconComponent],
  templateUrl: './dieteticien-tracking.component.html',
  styleUrl: './dieteticien-tracking.component.css',
})
export class DieteticienTrackingComponent {
  private readonly http = inject(HttpClient);
  private readonly api = inject(DietitianDashboardApi);
  private readonly destroyRef = inject(DestroyRef);
  private detailsGeneration = 0;
  private readonly pageSize = 8;

  readonly patients = signal<DietitianBeneficiary[]>([]);
  readonly details = signal<Record<number, PatientDetails>>({});
  readonly page = signal(0);
  readonly loading = signal(true);
  readonly detailsLoading = signal(false);
  readonly error = signal('');
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  readonly visiblePatients = computed(() => this.patients().slice(
    this.page() * this.pageSize, (this.page() + 1) * this.pageSize,
  ));
  readonly pageCount = computed(() => Math.ceil(this.patients().length / this.pageSize));
  readonly pageEnd = computed(() => Math.min((this.page() + 1) * this.pageSize, this.patients().length));
  readonly loadedDetails = computed(() => this.visiblePatients()
    .map((patient) => this.details()[patient.id]).filter((detail): detail is PatientDetails => !!detail));
  readonly goals = computed(() => this.loadedDetails().flatMap((detail) => detail.goals ?? [])
    .filter((goal) => goal.statut === 'EN_COURS' || goal.statut === 'ATTEINT'));
  readonly activeGoals = computed(() => this.goals().filter((goal) => goal.statut === 'EN_COURS'));
  readonly goalsUnavailable = computed(() => this.loadedDetails().some((detail) => detail.goals === null));
  readonly budgetsUnavailable = computed(() => this.loadedDetails().some((detail) => detail.budgets === null));
  readonly readableBudgets = computed(() => this.loadedDetails().filter((detail) => detail.budgets !== null).length);
  readonly progressValues = computed(() => this.goals()
    .map((goal) => goal.progressionPourcentage)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .map((value) => Math.min(100, Math.max(0, value))));
  readonly averageProgress = computed(() => this.progressValues().length
    ? Math.round(this.progressValues().reduce((sum, value) => sum + value, 0) / this.progressValues().length)
    : null);
  readonly budgetCount = computed(() => this.loadedDetails().filter((detail) => !!this.activeBudget(detail)).length);
  readonly progressBars = computed<ProgressBar[]>(() => {
    const groups = new Map<string, number[]>();
    for (const goal of this.goals()) {
      const value = goal.progressionPourcentage;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const key = goal.type || 'AUTRE';
      groups.set(key, [...(groups.get(key) ?? []), Math.min(100, Math.max(0, value))]);
    }
    const colors = ['#006aa4', '#f4b84a', '#ed8954', '#318062', '#26352d'];
    return [...groups.entries()].map(([type, values], index) => ({
      label: this.goalType(type),
      value: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      count: values.length,
      color: colors[index % colors.length],
    }));
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.beneficiaries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (patients) => {
        this.patients.set(patients);
        this.page.set(0);
        this.loading.set(false);
        this.loadVisibleDetails();
      },
      error: (cause: unknown) => {
        this.loading.set(false);
        this.error.set(this.describe(cause));
      },
    });
  }

  changePage(delta: number): void {
    const next = Math.min(Math.max(0, this.page() + delta), Math.max(0, this.pageCount() - 1));
    if (next === this.page()) return;
    this.page.set(next);
    this.loadVisibleDetails();
  }

  private loadVisibleDetails(): void {
    const generation = ++this.detailsGeneration;
    const missing = this.visiblePatients().filter((patient) => !this.details()[patient.id]);
    if (!missing.length) { this.detailsLoading.set(false); return; }
    this.detailsLoading.set(true);
    from(missing).pipe(
      mergeMap((patient) => this.getDetails(patient.id).pipe(map((details) => ({ id: patient.id, details }))), 4),
      toArray(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((results) => {
      if (generation !== this.detailsGeneration) return;
      this.details.update((current) => Object.fromEntries([
        ...Object.entries(current), ...results.map((result) => [result.id, result.details]),
      ]));
      this.detailsLoading.set(false);
    });
  }

  private getDetails(id: number) {
    const base = `${API_BASE_URL}/professionnel/beneficiaires/${id}`;
    return forkJoin({
      goals: this.http.get<Goal[]>(`${base}/objectifs`).pipe(catchError(() => of(null))),
      budgets: this.http.get<ApiPage<Budget>>(`${base}/budgets`, {
        params: new HttpParams().set('page', '0').set('size', '100'),
      }).pipe(map((page) => page.content), catchError(() => of(null))),
    });
  }

  mainGoal(details: PatientDetails | undefined): Goal | null {
    return details?.goals?.find((goal) => goal.statut === 'EN_COURS') ?? details?.goals?.[0] ?? null;
  }
  activeBudget(details: PatientDetails | undefined): Budget | null {
    return details?.budgets?.find((budget) => budget.actif) ?? null;
  }
  goalType(type: string): string {
    return ({
      PERTE_POIDS: 'Perte de poids', PRISE_POIDS: 'Prise de poids',
      MAINTIEN_POIDS: 'Maintien du poids', ALIMENTATION_EQUILIBREE: 'Alimentation équilibrée',
      AUTRE: 'Autre objectif',
    } as Record<string, string>)[type] ?? type.replaceAll('_', ' ').toLocaleLowerCase('fr');
  }
  goalLabel(goal: Goal | null): string {
    return goal?.description?.trim() || (goal ? this.goalType(goal.type) : 'Aucun objectif déclaré');
  }
  progress(goal: Goal | null): number | null {
    const value = goal?.progressionPourcentage;
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
  }
  followUpLabel(details: PatientDetails | undefined): string {
    if (!details) return 'Chargement…';
    if (!details.goals) return 'Objectifs indisponibles';
    const goal = this.mainGoal(details);
    if (!goal) return 'Aucun objectif déclaré';
    return ({ EN_COURS: 'En cours', ATTEINT: 'Objectif atteint', SUSPENDU: 'Suspendu', ABANDONNE: 'Abandonné' } as Record<string, string>)[goal.statut] ?? goal.statut;
  }
  name(patient: DietitianBeneficiary): string {
    return [patient.prenom, patient.nom].filter(Boolean).join(' ') || `Patient n° ${patient.id}`;
  }
  initials(patient: DietitianBeneficiary): string {
    return [patient.prenom?.[0], patient.nom?.[0]].filter(Boolean).join('').toLocaleUpperCase('fr') || 'P';
  }
  money(budget: Budget): string {
    const amount = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(budget.montant);
    return `${amount} ${budget.devise === 'XOF' || !budget.devise ? 'FCFA' : budget.devise}`;
  }
  hideBrokenImage(event: Event): void { (event.target as HTMLImageElement).remove(); }
  private describe(cause: unknown): string {
    return cause instanceof HttpErrorResponse && cause.status === 403
      ? 'Le suivi est réservé aux professionnels autorisés.'
      : 'Impossible de charger les patients. Vérifiez votre connexion puis réessayez.';
  }
}
