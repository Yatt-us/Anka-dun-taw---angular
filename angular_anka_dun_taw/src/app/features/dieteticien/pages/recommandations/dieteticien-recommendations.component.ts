import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, from, map, mergeMap, of, toArray } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { DietitianBeneficiary, DietitianDashboardApi, DietitianMenu } from '../../data-access/dieteticien-dashboard.data-access';

interface ApiPage<T> { content: T[] }
interface PatientProfile { zone?: string | null; commentaireSante?: string | null }
interface Budget { id: number; montant: number; devise: string; periode: string; actif: boolean }
interface Goal { id: number; description?: string | null; type?: string | null; statut?: string | null }
interface Meal { recetteId: number; jour: number; typeRepas: string; nombrePortions: number; commentaire?: string | null }
interface MenuDetail extends DietitianMenu {
  description?: string | null; type?: string; dateDebut?: string; dateFin?: string | null;
  zone?: string | null; objectifId?: number | null; budgetId?: number | null;
  recommandations?: string | null; repas?: Meal[] | null;
}
interface Draft { patientId: number; title: string; content: string; themeId: string }

const TEMPLATES = [
  { id: 'local', title: 'Produits locaux', label: 'Produits locaux', text: 'Privilégier les produits locaux disponibles dans votre zone et varier les céréales, légumes et sources de protéines selon vos préférences.' },
  { id: 'variete', title: 'Variété des repas', label: 'Repas variés', text: 'Composer des repas variés à partir des aliments accessibles, en tenant compte des portions prévues dans votre menu.' },
  { id: 'budget', title: 'Budget alimentaire', label: 'Petit budget', text: 'Comparer les prix des aliments de saison et choisir des alternatives locales compatibles avec votre budget.' },
  { id: 'contraintes', title: 'Préférences et restrictions', label: 'Restrictions', text: 'Vérifier les allergies et restrictions indiquées dans votre profil avant de préparer les recettes du menu.' },
] as const;

@Component({
  selector: 'app-dieteticien-recommendations',
  imports: [FormsModule, UiIconComponent],
  templateUrl: './dieteticien-recommendations.component.html',
  styleUrl: './dieteticien-recommendations.component.css',
})
export class DieteticienRecommendationsComponent {
  private readonly http = inject(HttpClient);
  private readonly api = inject(DietitianDashboardApi);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private selectionGeneration = 0;
  private readonly inMemoryDrafts = new Map<number, Draft>();

  readonly templates = TEMPLATES;
  readonly patients = signal<DietitianBeneficiary[]>([]);
  readonly menus = signal<MenuDetail[]>([]);
  readonly history = signal<MenuDetail[]>([]);
  readonly profile = signal<PatientProfile | null>(null);
  readonly budget = signal<Budget | null>(null);
  readonly goals = signal<Goal[]>([]);
  readonly selectedPatientId = signal<number | null>(null);
  readonly selectedMenuId = signal<number | null>(null);
  readonly selectedThemeId = signal<string>('local');
  readonly loading = signal(true);
  readonly detailsLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly draftSaved = signal(false);
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  readonly selectedPatient = computed(() => this.patients().find((item) => item.id === this.selectedPatientId()) ?? null);
  readonly patientMenus = computed(() => this.menus().filter((menu) => menu.beneficiaireIds?.includes(this.selectedPatientId() ?? -1)));
  readonly editableMenus = computed(() => this.patientMenus().filter((menu) => menu.statut === 'BROUILLON' || menu.statut === 'EN_VALIDATION'));
  readonly selectedTheme = computed(() => this.templates.find((item) => item.id === this.selectedThemeId()) ?? this.templates[0]);

  title = '';
  content = '';

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ patients: this.api.beneficiaries(), menus: this.api.menus() })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ patients, menus }) => {
          this.patients.set(patients);
          this.menus.set(menus as MenuDetail[]);
          this.loading.set(false);
          const draft = this.readDraft();
          const patientId = draft && patients.some((item) => item.id === draft.patientId) ? draft.patientId : patients[0]?.id ?? null;
          if (draft && patientId === draft.patientId) {
            this.title = draft.title;
            this.content = draft.content;
            this.selectedThemeId.set(draft.themeId);
            this.draftSaved.set(true);
          }
          this.selectPatient(patientId);
        },
        error: () => { this.loading.set(false); this.error.set('Impossible de charger les patients et les menus.'); },
      });
  }

  onPatientChange(event: Event): void {
    const previous = this.selectedPatientId();
    if (previous && (this.title.trim() || this.content.trim())) {
      this.inMemoryDrafts.set(previous, { patientId: previous, title: this.title, content: this.content, themeId: this.selectedThemeId() });
    }
    this.title = '';
    this.content = '';
    this.draftSaved.set(false);
    const next = Number((event.target as HTMLSelectElement).value);
    const draft = this.inMemoryDrafts.get(next) ?? this.readDraft();
    if (draft?.patientId === next) {
      this.title = draft.title;
      this.content = draft.content;
      this.selectedThemeId.set(draft.themeId);
    }
    this.selectPatient(next);
  }
  selectPatient(id: number | null): void {
    const generation = ++this.selectionGeneration;
    this.selectedPatientId.set(id);
    this.profile.set(null);
    this.budget.set(null);
    this.goals.set([]);
    this.history.set([]);
    this.error.set('');
    this.success.set('');
    this.selectedMenuId.set(this.editableMenus()[0]?.id ?? null);
    if (!id) return;
    this.detailsLoading.set(true);
    const base = `${API_BASE_URL}/professionnel/beneficiaires/${id}`;
    forkJoin({
      profile: this.http.get<PatientProfile>(`${base}/profil-nutritionnel`).pipe(catchError(() => of(null))),
      budgets: this.http.get<ApiPage<Budget>>(`${base}/budgets`, { params: new HttpParams().set('page', 0).set('size', 100) }).pipe(map((page) => page.content), catchError(() => of([] as Budget[]))),
      goals: this.http.get<Goal[]>(`${base}/objectifs`).pipe(catchError(() => of([] as Goal[]))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ profile, budgets, goals }) => {
      if (generation !== this.selectionGeneration) return;
      this.profile.set(profile);
      this.budget.set(budgets.find((item) => item.actif) ?? null);
      this.goals.set(goals);
      this.detailsLoading.set(false);
    });
    const patientMenus = this.patientMenus().slice(0, 8);
    from(patientMenus).pipe(
      mergeMap((menu) => this.http.get<MenuDetail>(`${API_BASE_URL}/professionnel/menus/${menu.id}`).pipe(catchError(() => of(menu))), 3),
      toArray(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((menus) => {
      if (generation !== this.selectionGeneration) return;
      this.history.set(menus.filter((item) => item.recommandations?.trim()));
    });
  }
  onMenuChange(event: Event): void { this.selectedMenuId.set(Number((event.target as HTMLSelectElement).value)); }
  editHistory(menu: MenuDetail): void {
    const saved = menu.recommandations?.trim() ?? '';
    const divider = saved.indexOf('\n\n');
    this.title = divider > 0 ? saved.slice(0, divider) : menu.titre;
    this.content = divider > 0 ? saved.slice(divider + 2) : saved;
    this.selectedMenuId.set(this.editableMenus().some((item) => item.id === menu.id) ? menu.id : this.editableMenus()[0]?.id ?? null);
    this.draftSaved.set(false);
    this.success.set('Recommandation chargée dans l’éditeur. Vérifiez le menu choisi avant d’enregistrer.');
  }
  selectTheme(id: string): void { this.selectedThemeId.set(id); }
  insertSuggestion(): void {
    const suggestion = this.selectedTheme();
    if (!this.title.trim()) this.title = suggestion.title;
    this.content = [this.content.trim(), suggestion.text].filter(Boolean).join('\n\n');
    this.draftSaved.set(false);
  }
  saveDraft(): void {
    const patientId = this.selectedPatientId();
    if (!patientId || !this.title.trim() || !this.content.trim()) { this.error.set('Choisissez un patient, un titre et rédigez la recommandation.'); return; }
    try {
      sessionStorage.setItem(this.draftKey(), JSON.stringify({ patientId, title: this.title.trim(), content: this.content.trim(), themeId: this.selectedThemeId() } satisfies Draft));
      this.draftSaved.set(true);
      this.error.set('');
      this.success.set('Brouillon conservé dans cet onglet jusqu’à sa fermeture.');
    } catch {
      this.error.set('Le navigateur ne peut pas conserver ce brouillon.');
    }
  }
  assign(): void {
    const patientId = this.selectedPatientId(), menuId = this.selectedMenuId();
    if (!patientId || !menuId || !this.title.trim() || !this.content.trim() || this.saving()) {
      this.error.set('Choisissez un patient et un menu modifiable, puis renseignez le titre et le contenu.'); return;
    }
    if (!this.editableMenus().some((item) => item.id === menuId)) { this.error.set('Ce menu ne peut plus être modifié.'); return; }
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.http.get<MenuDetail>(`${API_BASE_URL}/professionnel/menus/${menuId}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (menu) => {
        if (!menu.beneficiaireIds?.includes(patientId) || !['BROUILLON', 'EN_VALIDATION'].includes(menu.statut) ||
          !menu.titre || !menu.type || !menu.dateDebut || !menu.zone || !menu.repas?.length) {
          this.saving.set(false);
          this.error.set('Le menu a changé ou ses données sont incomplètes. Actualisez la page avant de réessayer.');
          return;
        }
        const recommendation = `${this.title.trim()}\n\n${this.content.trim()}`;
        const payload = {
          titre: menu.titre, description: menu.description ?? null, type: menu.type,
          dateDebut: menu.dateDebut, dateFin: menu.dateFin ?? null, zone: menu.zone ?? null,
          beneficiaireIds: menu.beneficiaireIds, objectifId: menu.objectifId ?? null,
          budgetId: menu.budgetId ?? null, recommandations: recommendation,
          repas: menu.repas.map((meal) => ({ recetteId: meal.recetteId, jour: meal.jour,
            typeRepas: meal.typeRepas, nombrePortions: meal.nombrePortions, commentaire: meal.commentaire ?? null })),
        };
        this.http.put<MenuDetail>(`${API_BASE_URL}/professionnel/menus/${menuId}`, payload)
          .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.saving.set(false);
              this.success.set(`Recommandation enregistrée dans « ${menu.titre} ».`);
              this.draftSaved.set(false);
              this.clearDraft();
              this.inMemoryDrafts.delete(patientId);
              this.history.update((items) => [{ ...menu, recommandations: recommendation }, ...items.filter((item) => item.id !== menuId)].slice(0, 8));
            },
            error: (cause: unknown) => { this.saving.set(false); this.error.set(this.describe(cause)); },
          });
      },
      error: (cause: unknown) => { this.saving.set(false); this.error.set(this.describe(cause)); },
    });
  }
  patientName(patient: DietitianBeneficiary): string { return [patient.prenom, patient.nom].filter(Boolean).join(' ') || `Patient n° ${patient.id}`; }
  money(amount: number, currency: string): string { return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} ${currency === 'XOF' ? 'FCFA' : currency}`; }
  hideBrokenImage(event: Event): void { (event.target as HTMLImageElement).hidden = true; }
  private draftKey(): string { return `adt:recommandations:dieteticien:${this.auth.currentUser()?.id ?? 'inconnu'}`; }
  private readDraft(): Draft | null {
    try {
      const raw = sessionStorage.getItem(this.draftKey());
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (typeof value !== 'object' || value === null) return null;
      const draft = value as Partial<Draft>;
      return typeof draft.patientId === 'number' && typeof draft.title === 'string' &&
        typeof draft.content === 'string' && typeof draft.themeId === 'string' ? draft as Draft : null;
    } catch { return null; }
  }
  private clearDraft(): void { try { sessionStorage.removeItem(this.draftKey()); } catch { /* stockage indisponible */ } }
  private describe(cause: unknown): string {
    return cause instanceof HttpErrorResponse && typeof cause.error?.message === 'string'
      ? cause.error.message : 'Impossible d’enregistrer la recommandation dans ce menu.';
  }
}
