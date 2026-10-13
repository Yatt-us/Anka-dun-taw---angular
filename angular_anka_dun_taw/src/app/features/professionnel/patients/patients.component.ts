import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { A11yModule } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, expand, forkJoin, from, map, mergeMap, of, reduce } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { UiIconComponent } from '../../../shared/components/ui-icon.component';
import { ActorId } from '../../../shared/components/workspace-config';

interface ApiPage<T> { content: T[]; number: number; totalPages: number; totalElements: number }
interface PatientSummary { id: number; nom: string; prenom: string; photoProfilUrl?: string | null }
interface Patient { id: number; name: string; lastName: string; photoProfilUrl?: string | null }
interface FoodPreference {
  type: 'AIME' | 'EVITE' | 'ALLERGIE' | 'RESTRICTION' | 'REGIME_ALIMENTAIRE';
  valeur: string;
}
interface NutritionProfile {
  id: number; nom?: string; statut?: string; objectifId?: number | null; budgetActifId?: number | null;
  zone?: string; poidsKg?: number; tailleCm?: number; imc?: number;
  dateNaissance?: string;
  niveauActivite?: string; modeBudget?: string; allergies?: string[];
  preferences?: FoodPreference[]; commentaireSante?: string;
}
interface Goal { id: number; description?: string; type?: string; statut?: string; progressionPourcentage?: number }
interface Budget { id: number; montant: number; devise?: string; periode?: string; actif?: boolean }
interface DailyBudget { date: string; montantDisponible: number; plafond: number; devise?: string }
interface AppointmentHistory { id: number; utilisateurId: number; dateHeure: string; motif?: string; statut: string }
interface PatientDetails { profile: NutritionProfile | null; goals: Goal[]; budgets: Budget[] }

@Component({
  selector: 'app-patients',
  imports: [FormsModule, RouterLink, A11yModule, UiIconComponent],
  templateUrl: './patients.component.html',
  styleUrl: './patients.component.css',
})
export class PatientsComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly detailsPending = new Set<number>();
  private loadGeneration = 0;
  private detailsTimer?: ReturnType<typeof setTimeout>;
  readonly actor = input.required<ActorId>();
  readonly patients = signal<Patient[]>([]);
  readonly summaries = signal<Record<number, PatientDetails>>({});
  readonly selected = signal<Patient | null>(null);
  readonly profile = signal<NutritionProfile | null>(null);
  readonly goals = signal<Goal[]>([]);
  readonly budgets = signal<Budget[]>([]);
  readonly dailyBudget = signal<DailyBudget | null>(null);
  readonly history = signal<AppointmentHistory[]>([]);
  readonly historyLoading = signal(false);
  readonly historyError = signal(false);
  readonly historyLoaded = signal(false);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly error = signal('');
  readonly detailError = signal('');
  readonly showFilters = signal(false);
  readonly showNewPatientHelp = signal(false);
  readonly searchQuery = signal('');
  readonly sortOrder = signal<'name' | 'name-desc' | 'id-desc'>('name');
  readonly patientPage = signal(0);
  readonly patientPageSize = 4;
  readonly filteredPatients = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('fr');
    const matches = this.patients().filter((patient) =>
      !query || patient.name.toLocaleLowerCase('fr').includes(query) || String(patient.id).includes(query),
    );
    return [...matches].sort((a, b) => this.sortOrder() === 'id-desc'
      ? b.id - a.id
      : this.sortOrder() === 'name-desc'
        ? b.lastName.localeCompare(a.lastName, 'fr') || b.name.localeCompare(a.name, 'fr')
        : a.lastName.localeCompare(b.lastName, 'fr') || a.name.localeCompare(b.name, 'fr'));
  });
  readonly selectedDetails = computed<PatientDetails>(() => ({
    profile: this.profile(), goals: this.goals(), budgets: this.budgets(),
  }));
  readonly selectedHistory = computed(() => this.history()
    .filter((item) => item.utilisateurId === this.selected()?.id)
    .sort((a, b) => b.dateHeure.localeCompare(a.dateHeure))
    .slice(0, 5));
  readonly visiblePatients = computed(() => this.filteredPatients().slice(
    this.patientPage() * this.patientPageSize,
    (this.patientPage() + 1) * this.patientPageSize,
  ));
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());
  selectedDate = this.localDate(new Date());

  constructor() {
    effect(() => { this.actor(); this.load(); });
    this.destroyRef.onDestroy(() => clearTimeout(this.detailsTimer));
  }

  load(): void {
    const generation = ++this.loadGeneration;
    clearTimeout(this.detailsTimer);
    this.loading.set(true);
    this.error.set('');
    this.patients.set([]);
    this.summaries.set({});
    this.detailsPending.clear();
    const getPage = (number: number) => this.http.get<ApiPage<PatientSummary>>(
      `${API_BASE_URL}/professionnel/beneficiaires`,
      { params: new HttpParams().set('page', String(number)).set('size', '100').set('sort', 'nom,asc') },
    );
    getPage(0).pipe(
      expand((page) => page.number + 1 < page.totalPages ? getPage(page.number + 1) : EMPTY),
      reduce((all, page) => all.concat(page.content), [] as PatientSummary[]),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (items) => {
        if (generation !== this.loadGeneration) return;
        this.patients.set(items.map((item) => ({
          id: item.id,
          name: [item.prenom, item.nom].filter(Boolean).join(' ') || `Patient n° ${item.id}`,
          lastName: item.nom || '',
          photoProfilUrl: item.photoProfilUrl,
        })));
        this.patientPage.set(0);
        this.loading.set(false);
        this.loadVisibleDetails();
        if (this.actor() === 'nutritionniste' && items.length) this.select(this.patients()[0]);
      },
      error: () => {
        if (generation !== this.loadGeneration) return;
        this.error.set('Chargement des patients liés impossible. Réessayez.');
        this.loading.set(false);
      },
    });
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.patientPage.set(0);
    if (this.actor() === 'nutritionniste') {
      const selected = this.selected();
      if (!selected || !this.filteredPatients().some((patient) => patient.id === selected.id)) {
        const first = this.filteredPatients()[0];
        if (first) this.select(first);
        else this.selected.set(null);
      }
    }
    clearTimeout(this.detailsTimer);
    this.detailsTimer = setTimeout(() => this.loadVisibleDetails(), 250);
  }
  onSort(value: 'name' | 'name-desc' | 'id-desc'): void {
    this.sortOrder.set(value);
    this.patientPage.set(0);
    this.loadVisibleDetails();
  }
  changePatientPage(delta: number): void {
    const last = Math.max(0, Math.ceil(this.filteredPatients().length / this.patientPageSize) - 1);
    this.patientPage.set(Math.min(last, Math.max(0, this.patientPage() + delta)));
    this.loadVisibleDetails();
  }
  lastVisibleIndex(): number {
    return Math.min((this.patientPage() + 1) * this.patientPageSize, this.filteredPatients().length);
  }

  private loadVisibleDetails(): void {
    const generation = this.loadGeneration;
    const toLoad = this.visiblePatients().filter((patient) =>
      !this.summaries()[patient.id] && !this.detailsPending.has(patient.id),
    );
    for (const patient of toLoad) this.detailsPending.add(patient.id);
    from(toLoad).pipe(
      mergeMap((patient) => this.getDetails(patient.id).pipe(map((details) => ({ id: patient.id, details }))), 3),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ id, details }) => {
      if (generation !== this.loadGeneration) return;
      this.detailsPending.delete(id);
      this.summaries.update((current) => ({ ...current, [id]: details }));
    });
  }

  private getDetails(id: number) {
    const base = `${API_BASE_URL}/professionnel/beneficiaires/${id}`;
    return forkJoin({
      profile: this.http.get<NutritionProfile>(`${base}/profil-nutritionnel`).pipe(catchError(() => of(null))),
      goals: this.http.get<Goal[]>(`${base}/objectifs`).pipe(catchError(() => of([] as Goal[]))),
      budgets: this.http.get<ApiPage<Budget>>(`${base}/budgets`).pipe(
        map((page) => page.content), catchError(() => of([] as Budget[])),
      ),
    });
  }

  select(patient: Patient): void {
    this.selected.set(patient);
    this.profile.set(null);
    this.goals.set([]);
    this.budgets.set([]);
    this.dailyBudget.set(null);
    this.detailError.set('');
    if (this.actor() === 'nutritionniste' && !this.historyLoaded() && !this.historyLoading()) this.loadHistory();
    const cached = this.summaries()[patient.id];
    if (cached) {
      this.setDetail(cached);
      this.detailLoading.set(false);
      return;
    }
    this.detailLoading.set(true);
    this.getDetails(patient.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((details) => {
      if (this.selected()?.id !== patient.id) return;
      this.setDetail(details);
      this.summaries.update((current) => ({ ...current, [patient.id]: details }));
      this.detailLoading.set(false);
    });
  }
  private setDetail(details: PatientDetails): void {
    this.profile.set(details.profile);
    this.goals.set(details.goals);
    this.budgets.set(details.budgets);
  }
  activeBudget(details: PatientDetails | undefined): Budget | null {
    if (!details) return null;
    const budgetId = details.profile?.budgetActifId;
    return details.budgets.find((budget) => budget.id === budgetId)
      ?? details.budgets.find((budget) => budget.actif)
      ?? null;
  }
  mainGoal(details: PatientDetails | undefined): string {
    const goal = details?.goals.find((item) => item.id === details.profile?.objectifId)
      ?? details?.goals.find((item) => item.statut === 'EN_COURS')
      ?? details?.goals[0];
    return goal?.description || goal?.type || 'Aucun objectif disponible';
  }
  profileLabel(details: PatientDetails | undefined): string {
    const profile = details?.profile;
    return profile?.nom?.trim() || (profile ? 'Profil nutritionnel actif' : 'Profil indisponible');
  }
  age(details: PatientDetails | undefined): string {
    const date = details?.profile?.dateNaissance;
    if (!date) return '';
    const birth = new Date(`${date}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return '';
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) years--;
    return years >= 0 ? `${years} ans` : '';
  }
  constraints(details: PatientDetails | undefined): { text: string; kind: 'positive' | 'negative' }[] {
    const profile = details?.profile;
    const preferences = (profile?.preferences ?? [])
      .filter((item) => item.valeur?.trim() && item.type !== 'REGIME_ALIMENTAIRE')
      .map((item) => ({ text: item.valeur.trim(), kind: item.type === 'AIME' ? 'positive' as const : 'negative' as const }));
    const allergies = (profile?.allergies ?? []).map((text) => ({ text, kind: 'negative' as const }));
    return [...preferences, ...allergies]
      .filter((item, index, items) => items.findIndex((other) =>
        other.text.toLocaleLowerCase('fr') === item.text.toLocaleLowerCase('fr')) === index)
      .slice(0, 3);
  }
  money(amount: number, devise?: string): string {
    const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
    return `${number} ${devise === 'XOF' || !devise ? 'F CFA' : devise}`;
  }
  initials(name: string): string { return name.split(' ').slice(0, 2).map((part) => part[0] || '').join('').toUpperCase(); }
  hideBrokenImage(event: Event): void { (event.target as HTMLImageElement).remove(); }
  loadDay(id: number): void {
    this.dailyBudget.set(null);
    this.http.get<DailyBudget>(`${API_BASE_URL}/professionnel/beneficiaires/${id}/petit-budget/jours/${this.selectedDate}`)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (budget) => this.dailyBudget.set(budget),
        error: () => this.detailError.set('Aucun budget petit montant disponible pour cette date.'),
      });
  }
  closeDetail(): void { this.selected.set(null); }
  retryHistory(): void { this.loadHistory(); }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.historyError.set(false);
    const getPage = (number: number) => this.http.get<ApiPage<AppointmentHistory>>(
      `${API_BASE_URL}/professionnel/rendez-vous`,
      { params: new HttpParams().set('statut', 'TERMINE').set('page', number).set('size', 100).set('sort', 'dateHeure,desc') },
    );
    getPage(0).pipe(
      expand((page) => page.number + 1 < page.totalPages ? getPage(page.number + 1) : EMPTY),
      reduce((all, page) => all.concat(page.content), [] as AppointmentHistory[]),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (items) => { this.history.set(items); this.historyLoaded.set(true); this.historyLoading.set(false); },
      error: () => { this.historyError.set(true); this.historyLoading.set(false); },
    });
  }

  private localDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
