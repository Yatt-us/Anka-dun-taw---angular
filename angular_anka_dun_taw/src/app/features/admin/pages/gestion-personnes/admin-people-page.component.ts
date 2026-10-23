import { HttpErrorResponse } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import {
  AdminPeopleDataAccess,
  AdminPeopleFilters,
  AdminPeoplePage,
  AdminPerson,
} from '../../data-access/admin-people.data-access';
import { AdminDashboardApi, AdminSearchResult } from '../../data-access/admin-dashboard.data-access';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { Subscription } from 'rxjs';

type PageKind = 'utilisateurs' | 'professionnels';
type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-people-page',
  imports: [
    A11yModule,
    MatButtonModule,
    UiIconComponent,
  ],
  templateUrl: './admin-people-page.component.html',
  styleUrls: ['./admin-people-page.component.css', './admin-people-list.component.css', './admin-professionals.component.css'],
})
export class AdminPeoplePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AdminPeopleDataAccess);
  private readonly dashboardApi = inject(AdminDashboardApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly kind: PageKind = this.route.snapshot.data['section'] === 'professionnels'
    ? 'professionnels'
    : 'utilisateurs';
  readonly title = this.kind === 'professionnels' ? 'Professionnels' : 'Utilisateurs';
  readonly description = this.kind === 'professionnels'
    ? 'Consultez les dossiers et validez les comptes professionnels.'
    : 'Consultez et gérez les comptes inscrits sur la plateforme.';

  readonly pageIndex = signal(0);
  readonly pageSize = signal(this.kind === 'utilisateurs' ? 5 : 6);
  readonly verificationStatus = signal('EN_ATTENTE');
  readonly verificationTabs = [
    { status: 'EN_ATTENTE', label: 'En attente' },
    { status: 'VERIFIE', label: 'Validés' },
    { status: 'REFUSE', label: 'Refusés' },
  ];
  readonly verificationCounts = signal<Record<string, number | null>>({ EN_ATTENTE: null, VERIFIE: null, REFUSE: null });
  readonly reviewIntent = signal<'review' | 'verify' | 'refuse'>('review');
  readonly search = signal('');
  readonly appliedSearch = signal('');
  readonly roleFilter = signal('');
  readonly statusFilter = signal('');
  readonly globalSearch = signal('');
  readonly globalResults = signal<AdminSearchResult[]>([]);
  readonly globalLoading = signal(false);
  readonly globalSearchError = signal(false);
  readonly exporting = signal(false);
  readonly state = signal<LoadState>('loading');
  readonly error = signal('');
  readonly result = signal<AdminPeoplePage>({ content: [], totalElements: 0 });
  readonly selected = signal<AdminPerson | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal('');
  readonly message = signal('');
  readonly refusalComment = signal('');
  readonly selectedRole = signal('UTILISATEUR');
  private readonly reloadKey = signal(0);

  readonly filteredPeople = computed(() => {
    if (this.kind === 'utilisateurs') return this.result().content;
    const query = this.search().trim().toLocaleLowerCase('fr');
    const people = this.result().content;
    if (!query) return people;
    return people.filter((person) => [
      this.fullName(person), person.email, person.telephone, person.role,
      person.specialite, person.numeroOrdre, person.statutVerification,
    ].filter(Boolean).join(' ').toLocaleLowerCase('fr').includes(query));
  });
  readonly pageCount = computed(() => Math.ceil(this.result().totalElements / this.pageSize()));
  readonly pageNumbers = computed(() => {
    const count = this.pageCount();
    const start = Math.max(0, Math.min(this.pageIndex() - 1, count - 3));
    return Array.from({ length: Math.min(3, count) }, (_, index) => start + index);
  });
  readonly firstVisible = computed(() => this.result().totalElements ? this.pageIndex() * this.pageSize() + 1 : 0);
  readonly lastVisible = computed(() => Math.min((this.pageIndex() + 1) * this.pageSize(), this.result().totalElements));

  constructor() {
    effect((onCleanup) => {
      const page = this.pageIndex();
      const size = this.pageSize();
      const filters = this.kind === 'utilisateurs' ? this.filters() : {};
      this.reloadKey();
      this.state.set('loading');
      this.error.set('');
      const request = this.kind === 'professionnels'
        ? this.api.professionals(page, size, this.verificationStatus())
        : this.api.accounts(page, size, filters);
      const subscription = request.subscribe({
        next: (data) => {
          if (page > 0 && page * size >= data.totalElements) {
            this.pageIndex.set(Math.max(0, Math.ceil(data.totalElements / size) - 1));
            return;
          }
          this.result.set(data); this.state.set('ready');
        },
        error: (error: unknown) => {
          this.error.set(this.describeError(error));
          this.state.set('error');
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
    effect((onCleanup) => {
      if (this.kind !== 'professionnels') return;
      this.reloadKey();
      const subscriptions = this.verificationTabs.map(({ status }) =>
        this.api.professionals(0, 1, status).subscribe({
          next: (page) => this.verificationCounts.update((counts) => ({ ...counts, [status]: page.totalElements })),
          error: () => this.verificationCounts.update((counts) => ({ ...counts, [status]: null })),
        }),
      );
      onCleanup(() => subscriptions.forEach((subscription) => subscription.unsubscribe()));
    });
    effect((onCleanup) => {
      const query = this.search().trim();
      if (this.kind !== 'utilisateurs') return;
      const timer = setTimeout(() => {
        this.pageIndex.set(0);
        this.appliedSearch.set(query);
      }, 250);
      onCleanup(() => clearTimeout(timer));
    });
    effect((onCleanup) => {
      const query = this.globalSearch().trim();
      this.globalResults.set([]);
      this.globalSearchError.set(false);
      this.globalLoading.set(query.length >= 2);
      if (query.length < 2) return;
      let subscription: Subscription | undefined;
      const timer = setTimeout(() => {
        subscription = this.dashboardApi.search(query).subscribe({
          next: (results) => { this.globalResults.set(results); this.globalLoading.set(false); },
          error: () => { this.globalSearchError.set(true); this.globalLoading.set(false); },
        });
      }, 250);
      onCleanup(() => { clearTimeout(timer); subscription?.unsubscribe(); });
    });
  }

  selectVerificationStatus(status: string): void {
    this.verificationStatus.set(status);
    this.pageIndex.set(0);
    this.search.set('');
    this.message.set('');
  }

  setSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  setRoleFilter(event: Event): void {
    this.roleFilter.set((event.target as HTMLSelectElement).value);
    this.pageIndex.set(0);
  }
  setStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.pageIndex.set(0);
  }
  setGlobalSearch(event: Event): void { this.globalSearch.set((event.target as HTMLInputElement).value); }
  openGlobalResult(result: AdminSearchResult): void {
    this.globalSearch.set('');
    if (result.type === 'professionnels' && this.kind === 'professionnels') {
      this.api.professional(result.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (person) => {
          this.selectVerificationStatus(person.statutVerification ?? 'EN_ATTENTE');
          this.open(person);
        },
        error: (error: unknown) => this.actionError.set(this.describeError(error)),
      });
      return;
    }
    if (result.type === 'utilisateurs' || result.type === 'professionnels') {
      if (result.type === this.kind) {
        this.search.set(result.titre);
        this.appliedSearch.set(result.titre);
        this.pageIndex.set(0);
        return;
      }
    }
    void this.router.navigate(['/espaces/admin', result.type]);
  }
  goToPage(index: number): void {
    if (index >= 0 && index < this.pageCount()) this.pageIndex.set(index);
  }
  exportCsv(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.actionError.set('');
    this.api.exportAccounts(this.filters()).subscribe({
      next: (file) => {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'comptes-anka-dun-taw.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.exporting.set(false);
      },
      error: (error: unknown) => {
        this.actionError.set(this.describeError(error));
        this.exporting.set(false);
      },
    });
  }
  private filters(): AdminPeopleFilters {
    return {
      recherche: this.appliedSearch(),
      role: this.roleFilter(),
      statut: this.statusFilter(),
    };
  }
  retry(): void { this.reloadKey.update((value) => value + 1); }

  open(person: AdminPerson): void {
    this.reviewIntent.set('review');
    this.selected.set(person);
    this.actionError.set('');
    this.refusalComment.set('');
    this.selectedRole.set(person.role ?? 'UTILISATEUR');
  }
  openReview(person: AdminPerson, intent: 'verify' | 'refuse'): void {
    this.open(person);
    this.reviewIntent.set(intent);
  }
  close(): void { if (!this.busy()) this.selected.set(null); }
  setRole(event: Event): void { this.selectedRole.set((event.target as HTMLSelectElement).value); }
  setRefusalComment(event: Event): void { this.refusalComment.set((event.target as HTMLTextAreaElement).value); }

  verify(): void {
    const person = this.selected();
    if (person?.statutVerification === 'EN_ATTENTE') this.runAction(this.api.verify(person.id), 'Professionnel vérifié.');
  }

  refuse(): void {
    const person = this.selected();
    if (!person || person.statutVerification !== 'EN_ATTENTE') return;
    if (!this.refusalComment().trim()) {
      this.actionError.set('Ajoutez un motif avant de refuser ce dossier.');
      return;
    }
    if (this.refusalComment().trim().length > 500) {
      this.actionError.set('Le motif est limité à 500 caractères.');
      return;
    }
    this.runAction(this.api.refuse(person.id, this.refusalComment().trim()), 'Dossier refusé.');
  }

  saveRole(): void {
    const person = this.selected();
    if (person && person.role !== 'DIETETICIEN' && person.role !== 'NUTRITIONNISTE') {
      this.runAction(this.api.changeRole(person.id, this.selectedRole()), 'Rôle du compte mis à jour.');
    }
  }

  deactivate(): void {
    const person = this.selected();
    if (person) this.runAction(this.api.deactivateUser(person.id), 'Compte désactivé.');
  }

  reactivate(): void {
    const person = this.selected();
    if (person && (person.statutCompte ?? person.statut) === 'DESACTIVE') {
      this.runAction(this.api.reactivateUser(person.id), 'Compte réactivé.');
    }
  }

  fullName(person: AdminPerson): string {
    return [person.prenom, person.nom].filter(Boolean).join(' ') || `Compte n° ${person.id}`;
  }

  roleLabel(role?: string): string {
    return ({ UTILISATEUR: 'Utilisateur', DIETETICIEN: 'Diététicien', NUTRITIONNISTE: 'Nutritionniste', ADMIN: 'Administrateur' } as Record<string, string>)[role ?? ''] ?? role ?? 'Non renseigné';
  }

  statusLabel(person: AdminPerson): string {
    const value = this.kind === 'professionnels' ? person.statutVerification : person.statutCompte ?? person.statut;
    return ({ ACTIF: 'Actif', DESACTIVE: 'Désactivé', SUSPENDU: 'Suspendu', EN_ATTENTE: 'En attente', VERIFIE: 'Vérifié', REFUSE: 'Refusé' } as Record<string, string>)[value ?? ''] ?? value ?? 'Non renseigné';
  }

  statusTone(person: AdminPerson): string {
    const value = this.kind === 'professionnels' ? person.statutVerification : person.statutCompte ?? person.statut;
    if (value === 'ACTIF' || value === 'VERIFIE') return 'green';
    if (value === 'REFUSE' || value === 'SUSPENDU' || value === 'DESACTIVE') return 'red';
    if (value === 'EN_ATTENTE') return 'orange';
    return 'neutral';
  }

  formatDate(value?: string): string {
    if (!value) return 'Non renseignée';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  formatShortDate(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(date);
  }

  initials(person: AdminPerson): string {
    return [person.prenom?.[0], person.nom?.[0]].filter(Boolean).join('').toLocaleUpperCase('fr') || '?';
  }

  hideBrokenImage(event: Event): void {
    (event.target as HTMLImageElement).hidden = true;
  }

  private runAction(request: ReturnType<AdminPeopleDataAccess['verify']>, success: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set(success);
        this.close();
        this.retry();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.actionError.set(this.describeError(error));
      },
    });
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Le serveur est injoignable. Vérifiez Spring Boot.';
      if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous.';
      if (error.status === 403) return 'Vous n’avez pas les droits pour cette action.';
      const message = error.error?.message;
      return typeof message === 'string' ? `Erreur ${error.status} : ${message}` : `Erreur ${error.status} du serveur.`;
    }
    return 'Une erreur inattendue est survenue.';
  }
}
