import { HttpErrorResponse } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { frenchPaginator } from '../../../../core/material-french';
import {
  AdminPeopleDataAccess,
  AdminPeoplePage,
  AdminPerson,
} from '../../data-access/admin-people.data-access';

type PageKind = 'utilisateurs' | 'professionnels';
type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-admin-people-page',
  providers: [{ provide: MatPaginatorIntl, useFactory: frenchPaginator }],
  imports: [
    A11yModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatTableModule,
  ],
  templateUrl: './admin-people-page.component.html',
  styleUrl: './admin-people-page.component.css',
})
export class AdminPeoplePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AdminPeopleDataAccess);
  readonly kind: PageKind = this.route.snapshot.data['section'] === 'professionnels'
    ? 'professionnels'
    : 'utilisateurs';
  readonly title = this.kind === 'professionnels' ? 'Professionnels' : 'Utilisateurs';
  readonly description = this.kind === 'professionnels'
    ? 'Consultez les dossiers et validez les comptes professionnels.'
    : 'Consultez et gérez les comptes inscrits sur la plateforme.';

  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly search = signal('');
  readonly listVisible = signal(this.kind === 'utilisateurs');
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
  readonly columns = ['person', 'contact', 'role', 'status', 'actions'];

  readonly filteredPeople = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('fr');
    const people = this.result().content;
    if (!query) return people;
    return people.filter((person) => [
      this.fullName(person), person.email, person.telephone, person.role,
      person.specialite, person.numeroOrdre, person.statutVerification,
    ].filter(Boolean).join(' ').toLocaleLowerCase('fr').includes(query));
  });

  constructor() {
    effect((onCleanup) => {
      const page = this.pageIndex();
      const size = this.pageSize();
      this.reloadKey();
      this.state.set('loading');
      this.error.set('');
      const request = this.kind === 'professionnels'
        ? this.api.professionals(page, size)
        : this.api.users(page, size);
      const subscription = request.subscribe({
        next: (data) => { this.result.set(data); this.state.set('ready'); },
        error: (error: unknown) => {
          this.error.set(this.describeError(error));
          this.state.set('error');
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  setSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  toggleList(): void { this.listVisible.update((visible) => !visible); }
  retry(): void { this.reloadKey.update((value) => value + 1); }

  open(person: AdminPerson): void {
    this.selected.set(person);
    this.actionError.set('');
    this.refusalComment.set('');
    this.selectedRole.set(person.role ?? 'UTILISATEUR');
  }
  close(): void { this.selected.set(null); }
  setRole(event: Event): void { this.selectedRole.set((event.target as HTMLSelectElement).value); }
  setRefusalComment(event: Event): void { this.refusalComment.set((event.target as HTMLTextAreaElement).value); }

  verify(): void {
    const person = this.selected();
    if (person) this.runAction(this.api.verify(person.id), 'Professionnel vérifié.');
  }

  refuse(): void {
    const person = this.selected();
    if (!person) return;
    if (!this.refusalComment().trim()) {
      this.actionError.set('Ajoutez un motif avant de refuser ce dossier.');
      return;
    }
    this.runAction(this.api.refuse(person.id, this.refusalComment().trim()), 'Dossier refusé.');
  }

  saveRole(): void {
    const person = this.selected();
    if (person) this.runAction(this.api.changeRole(person.id, this.selectedRole()), 'Rôle du compte mis à jour.');
  }

  deactivate(): void {
    const person = this.selected();
    if (person) this.runAction(this.api.deactivateUser(person.id), 'Compte désactivé.');
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
    request.subscribe({
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
