import { HttpErrorResponse } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subscription, expand } from 'rxjs';
import { AdminAdvice, AdminChallenge, AdminContentDataAccess, AdminQuiz, ContentPage, ContentStatus } from '../../data-access/admin-content.data-access';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { EditorKind } from '../../../../shared/forms/workspace-editor.service';
import { WorkspaceEditorComponent } from '../../../../shared/forms/workspace-editor.component';

type Tab = 'quiz' | 'defis' | 'conseils' | 'jour';
type State = 'loading' | 'ready' | 'error';
type Selection = { kind: 'quiz' | 'challenge' | 'advice'; id: number; title: string; status: string };

@Component({
  selector: 'app-admin-content',
  imports: [A11yModule, UiIconComponent, WorkspaceEditorComponent],
  templateUrl: './admin-content.component.html',
  styleUrl: './admin-content.component.css',
})
export class AdminContentComponent {
  private readonly api = inject(AdminContentDataAccess);
  private readonly destroyRef = inject(DestroyRef);
  private listSubscriptions = new Subscription();
  readonly tab = signal<Tab>('quiz');
  readonly query = signal('');
  readonly statusFilter = signal<ContentStatus | ''>('');
  readonly dayFilter = signal<'all' | 'scheduled' | 'ordinary'>('all');
  readonly quizzes = signal<AdminQuiz[]>([]);
  readonly challenges = signal<AdminChallenge[]>([]);
  readonly advice = signal<AdminAdvice[]>([]);
  readonly quizState = signal<State>('loading');
  readonly challengesState = signal<State>('loading');
  readonly adviceState = signal<State>('loading');
  readonly error = signal('');
  readonly actionError = signal('');
  readonly message = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = 8;
  readonly editorKind = signal<EditorKind | null>(null);
  readonly editId = signal<number | undefined>(undefined);
  readonly selected = signal<Selection | null>(null);
  readonly deleteConfirmation = signal(false);
  readonly busy = signal(false);

  readonly filteredQuizzes = computed(() => {
    const term = this.query().trim().toLocaleLowerCase('fr');
    return this.quizzes().filter((quiz) => {
      if (this.tab() === 'jour' && !quiz.contenu.dateQuestionDuJour) return false;
      if (this.statusFilter() && quiz.statut !== this.statusFilter()) return false;
      if (this.dayFilter() === 'scheduled' && !quiz.contenu.dateQuestionDuJour) return false;
      if (this.dayFilter() === 'ordinary' && quiz.contenu.dateQuestionDuJour) return false;
      return !term || quiz.contenu.titre.toLocaleLowerCase('fr').includes(term);
    });
  });
  readonly filteredChallenges = computed(() => {
    const term = this.query().trim().toLocaleLowerCase('fr');
    return this.challenges().filter((challenge) => (!this.statusFilter() || challenge.statut === this.statusFilter()) &&
      (!term || `${challenge.titre} ${challenge.description || ''}`.toLocaleLowerCase('fr').includes(term)));
  });
  readonly filteredAdvice = computed(() => {
    const term = this.query().trim().toLocaleLowerCase('fr');
    return this.advice().filter((item) => !term || `${item.titre} ${item.categorie || ''}`.toLocaleLowerCase('fr').includes(term));
  });
  readonly activeItems = computed(() => this.tab() === 'defis' ? this.filteredChallenges() : this.tab() === 'conseils' ? this.filteredAdvice() : this.filteredQuizzes());
  readonly visibleQuizzes = computed(() => this.filteredQuizzes().slice(this.pageIndex() * this.pageSize, (this.pageIndex() + 1) * this.pageSize));
  readonly visibleChallenges = computed(() => this.filteredChallenges().slice(this.pageIndex() * this.pageSize, (this.pageIndex() + 1) * this.pageSize));
  readonly visibleAdvice = computed(() => this.filteredAdvice().slice(this.pageIndex() * this.pageSize, (this.pageIndex() + 1) * this.pageSize));
  readonly pageCount = computed(() => Math.ceil(this.activeItems().length / this.pageSize));
  readonly pageNumbers = computed(() => {
    const count = this.pageCount();
    const start = Math.max(0, Math.min(this.pageIndex() - 1, count - 3));
    return Array.from({ length: Math.min(3, count) }, (_, index) => start + index);
  });
  readonly featuredChallenges = computed(() => this.challenges().filter((item) => item.statut === 'PUBLIE').slice(0, 3));
  readonly draftCount = computed(() => this.quizzes().filter((item) => item.statut === 'BROUILLON').length + this.challenges().filter((item) => item.statut === 'BROUILLON').length);
  readonly activeState = computed(() => this.tab() === 'defis' ? this.challengesState() : this.tab() === 'conseils' ? this.adviceState() : this.quizState());

  constructor() {
    this.destroyRef.onDestroy(() => this.listSubscriptions.unsubscribe());
    this.reload();
  }

  private loadAll<T>(source: (page: number) => Observable<ContentPage<T>>, target: { update(fn: (value: T[]) => T[]): void; set(value: T[]): void }, state: { set(value: State): void }): Subscription {
    target.set([]);
    state.set('loading');
    return source(0).pipe(
      expand((page) => page.number + 1 < page.totalPages ? source(page.number + 1) : EMPTY),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (page) => { target.update((items) => [...items, ...page.content]); state.set('ready'); },
      error: (error: unknown) => { this.error.set(this.describeError(error)); state.set('error'); },
    });
  }
  reload(): void {
    this.listSubscriptions.unsubscribe();
    this.listSubscriptions = new Subscription();
    this.error.set('');
    this.listSubscriptions.add(this.loadAll((page) => this.api.quizzes(page), this.quizzes, this.quizState));
    this.listSubscriptions.add(this.loadAll((page) => this.api.challenges(page), this.challenges, this.challengesState));
    this.listSubscriptions.add(this.loadAll((page) => this.api.advice(page), this.advice, this.adviceState));
  }
  selectTab(tab: Tab): void { this.tab.set(tab); this.pageIndex.set(0); this.statusFilter.set(''); this.dayFilter.set('all'); }
  setQuery(event: Event): void { this.query.set((event.target as HTMLInputElement).value); this.pageIndex.set(0); }
  setStatus(event: Event): void { this.statusFilter.set((event.target as HTMLSelectElement).value as ContentStatus | ''); this.pageIndex.set(0); }
  setDayFilter(event: Event): void { this.dayFilter.set((event.target as HTMLSelectElement).value as 'all' | 'scheduled' | 'ordinary'); this.pageIndex.set(0); }
  goToPage(page: number): void { if (page >= 0 && page < this.pageCount()) this.pageIndex.set(page); }
  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }
  challengeState(challenge: AdminChallenge): string {
    if (challenge.statut === 'BROUILLON') return 'Brouillon';
    if (challenge.statut === 'ARCHIVE') return 'Archivé';
    const today = new Date().toISOString().slice(0, 10);
    if (challenge.dateDebut && challenge.dateDebut > today) return 'Planifié';
    if (challenge.dateFin && challenge.dateFin < today) return 'Terminé';
    return 'En cours';
  }
  newContent(): void {
    if (this.tab() === 'conseils') return;
    this.deleteConfirmation.set(false);
    this.editId.set(undefined);
    this.editorKind.set(this.tab() === 'defis' ? 'challenge' : 'quiz');
    this.actionError.set('');
  }
  edit(selection: Selection): void {
    if (selection.kind === 'advice') return;
    this.selected.set(null);
    this.deleteConfirmation.set(false);
    if (selection.status !== 'BROUILLON') { this.selected.set(selection); return; }
    this.editId.set(selection.id);
    this.editorKind.set(selection.kind);
  }
  closeEditor(): void { this.editorKind.set(null); }
  editorSaved(): void { this.editorKind.set(null); this.message.set('Contenu enregistré.'); this.reload(); }
  openQuiz(quiz: AdminQuiz): void { this.deleteConfirmation.set(false); this.selected.set({ kind: 'quiz', id: quiz.id, title: quiz.contenu.titre, status: quiz.statut }); this.actionError.set(''); }
  openDeleteQuiz(quiz: AdminQuiz): void {
    this.confirmDraftDeletion({ kind: 'quiz', id: quiz.id, title: quiz.contenu.titre, status: quiz.statut });
  }
  openChallenge(challenge: AdminChallenge): void { this.deleteConfirmation.set(false); this.selected.set({ kind: 'challenge', id: challenge.id, title: challenge.titre, status: challenge.statut }); this.actionError.set(''); }
  openAdvice(item: AdminAdvice): void { this.deleteConfirmation.set(false); this.selected.set({ kind: 'advice', id: item.id, title: item.titre, status: item.statut }); this.actionError.set(''); }
  closeSelection(): void { this.selected.set(null); this.deleteConfirmation.set(false); }
  confirmDraftDeletion(item: Selection): void {
    if (item.kind !== 'quiz' || item.status !== 'BROUILLON') return;
    this.selected.set(item);
    this.deleteConfirmation.set(true);
    this.actionError.set('');
  }
  deleteDraftQuiz(item: Selection): void {
    if (this.busy() || item.kind !== 'quiz' || item.status !== 'BROUILLON') return;
    this.busy.set(true);
    this.api.deleteDraftQuiz(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.closeSelection();
        this.message.set('Quiz en brouillon supprimé.');
        this.reload();
      },
      error: (error: unknown) => { this.busy.set(false); this.actionError.set(this.describeError(error)); },
    });
  }
  perform(action: 'publish' | 'archive' | 'restore', item: Selection): void {
    if (this.busy() || item.kind === 'advice') return;
    this.busy.set(true);
    const request = item.kind === 'quiz'
      ? action === 'publish' ? this.api.publishQuiz(item.id) : action === 'archive' ? this.api.archiveQuiz(item.id) : this.api.restoreQuiz(item.id)
      : action === 'publish' ? this.api.publishChallenge(item.id) : action === 'archive' ? this.api.archiveChallenge(item.id) : this.api.restoreChallenge(item.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.selected.set(null);
        this.message.set(action === 'publish' ? 'Contenu publié.' : action === 'archive' ? 'Contenu archivé.' : 'Contenu restauré et publié.');
        this.reload();
      },
      error: (error: unknown) => { this.busy.set(false); this.actionError.set(this.describeError(error)); },
    });
  }
  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Le serveur est injoignable. Vérifiez la connexion au backend.';
      if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous.';
      if (error.status === 403) return 'Vous n’avez pas accès à cette action.';
      const body = error.error;
      if (body && typeof body.message === 'string') return body.message;
      return `La requête a échoué (HTTP ${error.status}).`;
    }
    return 'Cette opération a échoué. Réessayez.';
  }
}
