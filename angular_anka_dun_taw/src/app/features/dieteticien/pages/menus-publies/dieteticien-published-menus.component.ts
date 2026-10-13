import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { EMPTY, catchError, expand, forkJoin, Observable, of, reduce } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { WorkspaceEditorComponent } from '../../../../shared/forms/workspace-editor.component';
import { DietitianBeneficiary, DietitianDashboardApi, DietitianMenu } from '../../data-access/dieteticien-dashboard.data-access';

interface ApiPage<T> { content: T[]; number: number; totalPages: number }
interface Meal { recetteId: number; recetteNom?: string | null; jour: number; typeRepas: string; nombrePortions: number; coutEstime?: number | null; commentaire?: string | null }
interface Menu extends DietitianMenu {
  description?: string | null; type?: string; dateDebut?: string; dateFin?: string | null;
  datePublication?: string | null; publieLe?: string | null; zone?: string | null;
  objectifId?: number | null; budgetId?: number | null; recommandations?: string | null;
  coutTotalEstime?: number | null;
  repas?: Meal[] | null;
}
interface MenuCost { menuId: number; coutTotalEstime: number | null; devise: string; prixDisponibles: boolean }
interface CreatedMenu { id: number }
interface MenuVersion {
  id: number; menuId: number; numeroVersion: number; dateVersion: string;
  motifModification: string; instantane: Menu;
}

@Component({
  selector: 'app-dieteticien-published-menus',
  imports: [FormsModule, RouterLink, A11yModule, UiIconComponent, WorkspaceEditorComponent],
  templateUrl: './dieteticien-published-menus.component.html',
  styleUrl: './dieteticien-published-menus.component.css',
})
export class DieteticienPublishedMenusComponent {
  private readonly http = inject(HttpClient);
  private readonly api = inject(DietitianDashboardApi);
  private readonly destroyRef = inject(DestroyRef);
  private detailGeneration = 0;
  readonly menus = signal<Menu[]>([]);
  readonly patients = signal<DietitianBeneficiary[]>([]);
  readonly costs = signal<MenuCost[]>([]);
  readonly loading = signal(true);
  readonly costsError = signal(false);
  readonly detailLoading = signal(false);
  readonly versionLoading = signal(false);
  readonly versionError = signal('');
  readonly versions = signal<MenuVersion[]>([]);
  readonly selectedVersion = signal<MenuVersion | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly detailError = signal('');
  readonly success = signal('');
  readonly searchQuery = signal('');
  readonly statusFilter = signal('PUBLICS');
  readonly page = signal(0);
  readonly selected = signal<Menu | null>(null);
  readonly editorOpen = signal(false);
  readonly cloneOpen = signal(false);
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  readonly pageSize = 8;
  readonly activeCount = computed(() => this.menus().filter((item) => item.statut === 'PUBLIE').length);
  readonly archivedCount = computed(() => this.menus().filter((item) => item.statut === 'ARCHIVE').length);
  readonly averageWeeklyCost = computed(() => {
    const values = this.menus().filter((item) => item.statut === 'PUBLIE' && this.durationDays(item) === 7)
      .map((item) => this.costFor(item.id)).filter((cost): cost is MenuCost => !!cost?.prixDisponibles && cost.coutTotalEstime !== null && cost.devise === 'XOF');
    return values.length ? values.reduce((sum, item) => sum + item.coutTotalEstime!, 0) / values.length : null;
  });
  readonly filtered = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('fr');
    return this.menus().filter((menu) => {
      if (this.statusFilter() === 'PUBLICS' && !['PUBLIE', 'ARCHIVE'].includes(menu.statut)) return false;
      if (this.statusFilter() !== 'TOUS' && this.statusFilter() !== 'PUBLICS' && menu.statut !== this.statusFilter()) return false;
      if (!query) return true;
      return `${menu.titre} ${this.patientName(menu.beneficiaireIds)} ${menu.type ?? ''}`.toLocaleLowerCase('fr').includes(query);
    });
  });
  readonly visible = computed(() => this.filtered().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize));
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));

  cloneTitle = '';
  cloneStart = '';
  cloneEnd = '';

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.costsError.set(false);
    forkJoin({
      menus: this.api.menus(), patients: this.api.beneficiaries(),
      costs: this.allCosts().pipe(catchError(() => { this.costsError.set(true); return of([] as MenuCost[]); })),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ menus, patients, costs }) => {
        this.menus.set(menus as Menu[]);
        this.patients.set(patients);
        this.costs.set(costs);
        this.page.set(0);
        this.loading.set(false);
      },
      error: (cause: unknown) => { this.error.set(this.describe(cause, 'Impossible de charger vos menus.')); this.loading.set(false); },
    });
  }
  private allCosts(): Observable<MenuCost[]> {
    const getPage = (page: number) => this.http.get<ApiPage<MenuCost>>(`${API_BASE_URL}/professionnel/menus/couts-estimes`, {
      params: new HttpParams().set('page', page).set('size', 100),
    });
    return getPage(0).pipe(expand((result) => result.number + 1 < result.totalPages ? getPage(result.number + 1) : EMPTY),
      reduce((all, result) => all.concat(result.content), [] as MenuCost[]));
  }
  updateSearch(event: Event): void { this.searchQuery.set((event.target as HTMLInputElement).value); this.page.set(0); }
  updateStatus(event: Event): void { this.statusFilter.set((event.target as HTMLSelectElement).value); this.page.set(0); }
  changePage(delta: number): void { this.page.update((value) => Math.max(0, Math.min(this.totalPages() - 1, value + delta))); }
  costFor(id: number): MenuCost | null { return this.costs().find((item) => item.menuId === id) ?? null; }
  durationDays(menu: Menu): number | null {
    if (!menu.dateDebut || !menu.dateFin) return null;
    const start = new Date(`${menu.dateDebut}T12:00:00`).getTime(), end = new Date(`${menu.dateFin}T12:00:00`).getTime();
    const days = Math.round((end - start) / 86400000) + 1;
    return Number.isFinite(days) && days > 0 ? days : null;
  }
  durationLabel(menu: Menu): string { const days = this.durationDays(menu); return days ? `${days} jour${days > 1 ? 's' : ''}` : 'Non renseignée'; }
  publishedDate(menu: Menu): string {
    const value = menu.datePublication ?? menu.publieLe;
    if (!value) return 'Non renseignée';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Non renseignée' : date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  patientName(ids: number[] | null | undefined): string {
    if (!ids?.length) return 'Patient non renseigné';
    return ids.map((id) => {
      const patient = this.patients().find((item) => item.id === id);
      return patient ? [patient.prenom, patient.nom].filter(Boolean).join(' ') : `Patient n° ${id}`;
    }).join(', ');
  }
  patientPhoto(ids: number[] | null | undefined): string | null {
    return ids?.length === 1 ? this.patients().find((item) => item.id === ids[0])?.photoProfilUrl ?? null : null;
  }
  hideBrokenImage(event: Event): void { (event.target as HTMLImageElement).hidden = true; }
  label(value: string): string { return value.toLocaleLowerCase('fr').replaceAll('_', ' ').replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('fr')); }
  money(amount: number | null | undefined, currency = 'XOF'): string {
    return amount == null ? 'Prix indisponible' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} ${currency === 'XOF' ? 'FCFA' : currency}`;
  }
  openDetail(menu: Menu): void {
    const generation = ++this.detailGeneration;
    this.selected.set(menu);
    this.cloneOpen.set(false);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.versions.set([]);
    this.selectedVersion.set(null);
    this.loadVersions(menu.id, generation);
    this.http.get<Menu>(`${API_BASE_URL}/professionnel/menus/${menu.id}`)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (detail) => { if (generation !== this.detailGeneration) return; this.selected.set(detail); this.detailLoading.set(false); },
        error: (cause: unknown) => { if (generation !== this.detailGeneration) return; this.detailLoading.set(false); this.detailError.set(this.describe(cause, 'Détail du menu indisponible.')); },
      });
  }
  private loadVersions(menuId: number, generation: number): void {
    this.versionLoading.set(true);
    this.versionError.set('');
    const getPage = (page: number) => this.http.get<ApiPage<MenuVersion>>(
      `${API_BASE_URL}/professionnel/menus/${menuId}/versions`,
      { params: new HttpParams().set('page', page).set('size', 100) },
    );
    getPage(0).pipe(
      expand((result) => result.number + 1 < result.totalPages ? getPage(result.number + 1) : EMPTY),
      reduce((all, result) => all.concat(result.content), [] as MenuVersion[]),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (versions) => {
        if (generation !== this.detailGeneration) return;
        this.versions.set(versions);
        this.versionLoading.set(false);
      },
      error: (cause: unknown) => {
        if (generation !== this.detailGeneration) return;
        this.versionLoading.set(false);
        this.versionError.set(this.describe(cause, 'Historique des versions indisponible.'));
      },
    });
  }
  retryVersions(): void {
    const menu = this.selected();
    if (menu) this.loadVersions(menu.id, this.detailGeneration);
  }
  toggleVersion(version: MenuVersion): void {
    this.selectedVersion.set(this.selectedVersion()?.id === version.id ? null : version);
  }
  versionDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date inconnue' : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  }
  closeDetail(): void {
    if (!this.saving()) {
      ++this.detailGeneration;
      this.selected.set(null);
      this.cloneOpen.set(false);
      this.selectedVersion.set(null);
      this.versions.set([]);
    }
  }
  canEdit(menu: Menu): boolean { return menu.statut === 'BROUILLON' || menu.statut === 'EN_VALIDATION'; }
  editMenu(menu: Menu): void {
    if (!this.canEdit(menu)) return;
    this.selected.set(menu);
    this.editorOpen.set(true);
  }
  openEditor(): void { if (this.selected() && this.canEdit(this.selected()!)) this.editorOpen.set(true); }
  closeEditor(): void { if (!this.saving()) this.editorOpen.set(false); }
  editorSaved(): void { this.editorOpen.set(false); this.closeDetail(); this.success.set('Menu modifié. Vérifiez son coût avant de le publier.'); this.load(); }
  prepareClone(): void {
    const menu = this.selected();
    if (!menu?.repas?.length || !menu.type || !menu.zone || !menu.beneficiaireIds?.length) {
      this.detailError.set('Les informations du menu sont incomplètes pour créer une copie.'); return;
    }
    this.cloneTitle = `Copie de ${menu.titre}`;
    this.cloneStart = this.localDate(new Date());
    const end = new Date(`${this.cloneStart}T12:00:00`);
    end.setDate(end.getDate() + Math.max(1, this.durationDays(menu) ?? 7) - 1);
    this.cloneEnd = this.localDate(end);
    this.cloneOpen.set(true);
    this.detailError.set('');
  }
  clone(): void {
    const menu = this.selected();
    if (!menu || this.saving() || !this.cloneTitle.trim() || !this.cloneStart || !this.cloneEnd || this.cloneEnd < this.cloneStart ||
      !menu.repas?.length || !menu.type || !menu.zone || !menu.beneficiaireIds?.length) {
      this.detailError.set('Vérifiez le titre, les dates et les données du menu.'); return;
    }
    const lastMealDay = Math.max(...menu.repas.map((meal) => meal.jour));
    const span = Math.round((new Date(`${this.cloneEnd}T12:00:00`).getTime() - new Date(`${this.cloneStart}T12:00:00`).getTime()) / 86400000) + 1;
    if (lastMealDay > span) { this.detailError.set('La période choisie ne couvre pas tous les repas du menu.'); return; }
    this.saving.set(true);
    this.detailError.set('');
    const payload = {
      titre: this.cloneTitle.trim(), description: menu.description ?? null, type: menu.type,
      dateDebut: this.cloneStart, dateFin: this.cloneEnd, zone: menu.zone,
      beneficiaireIds: menu.beneficiaireIds, objectifId: menu.objectifId ?? null,
      budgetId: menu.budgetId ?? null, recommandations: menu.recommandations ?? null,
      repas: menu.repas.map((meal) => ({ recetteId: meal.recetteId, jour: meal.jour, typeRepas: meal.typeRepas,
        nombrePortions: meal.nombrePortions, commentaire: meal.commentaire ?? null })),
    };
    this.http.post<CreatedMenu>(`${API_BASE_URL}/professionnel/menus`, payload)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.closeDetail();
          this.success.set(`Copie créée en brouillon (menu n° ${created.id}). Vérifiez-la dans « Validation des menus ».`);
          this.load();
        },
        error: (cause: unknown) => { this.saving.set(false); this.detailError.set(this.describe(cause, 'Impossible de dupliquer le menu.')); },
      });
  }
  private localDate(date: Date): string {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  private describe(cause: unknown, fallback: string): string {
    return cause instanceof HttpErrorResponse && typeof cause.error?.message === 'string' ? cause.error.message : fallback;
  }
}
