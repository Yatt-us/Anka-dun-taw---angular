import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { EMPTY, expand, of, reduce, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';

interface Advice {
  id: number; titre: string; contenu: string; categorie: string | null;
  statut: 'BROUILLON' | 'PUBLIE' | 'ARCHIVE';
  validateurId: number | null; datePublication: string | null; dateValidation: string | null;
}
interface ApiPage<T> { content: T[]; number: number; totalPages: number }

@Component({
  selector: 'app-nutritionniste-advice',
  imports: [DatePipe, FormsModule, UiIconComponent],
  templateUrl: './nutritionniste-advice.component.html',
  styleUrl: './nutritionniste-advice.component.css',
})
export class NutritionnisteAdviceComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly items = signal<Advice[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly selected = signal<Advice | null>(null);
  readonly editorOpen = signal(false);
  readonly busy = signal(false);
  readonly pendingArchive = signal<Advice | null>(null);
  readonly showingArchived = signal(false);
  readonly categories = ['Alimentation', 'Recettes', 'Nutrition', 'Budget', 'Bébés'];
  readonly visible = computed(() => this.items().filter((item) => this.showingArchived()
    ? item.statut === 'ARCHIVE' : item.statut !== 'ARCHIVE'));
  readonly archivedCount = computed(() => this.items().filter((item) => item.statut === 'ARCHIVE').length);
  form = { titre: '', categorie: '', contenu: '' };

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const getPage = (number: number) => this.http.get<ApiPage<Advice>>(`${API_BASE_URL}/conseils/mes-conseils`, {
      params: new HttpParams().set('page', number).set('size', 100).set('sort', 'id,desc'),
    });
    getPage(0).pipe(
      expand((page) => page.number + 1 < page.totalPages ? getPage(page.number + 1) : EMPTY),
      reduce((all, page) => all.concat(page.content), [] as Advice[]),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (items) => { this.items.set(items); this.loading.set(false); },
      error: (cause: unknown) => { this.error.set(this.describe(cause)); this.loading.set(false); },
    });
  }

  newAdvice(): void {
    this.selected.set(null);
    this.form = { titre: '', categorie: '', contenu: '' };
    this.error.set('');
    this.editorOpen.set(true);
  }
  edit(item: Advice): void {
    this.selected.set(item);
    this.form = { titre: item.titre, categorie: item.categorie || '', contenu: item.contenu };
    this.error.set('');
    this.editorOpen.set(true);
  }
  closeEditor(): void { if (!this.busy()) this.editorOpen.set(false); }
  canEdit(): boolean { return !this.selected() || this.selected()?.statut === 'BROUILLON'; }
  displayStatus(item: Advice): string { return item.statut === 'PUBLIE' ? 'Publié' : item.statut === 'ARCHIVE' ? 'Archivé' : 'Brouillon'; }
  toggleArchived(): void { this.showingArchived.update((value) => !value); }
  preview(item: Advice): string { return item.contenu.length > 125 ? item.contenu.slice(0, 125).trimEnd() + '…' : item.contenu; }

  save(form: NgForm, publish = false): void {
    if (this.busy() || !this.canEdit()) return;
    this.error.set(''); this.notice.set('');
    const payload = { titre: this.form.titre.trim(), categorie: this.form.categorie.trim() || null, contenu: this.form.contenu.trim() };
    if (form.invalid || !payload.titre || !payload.contenu) {
      form.control.markAllAsTouched(); this.error.set('Renseignez le titre et le contenu du conseil.'); return;
    }
    this.busy.set(true);
    const current = this.selected();
    const saveRequest = current
      ? this.http.put<Advice>(`${API_BASE_URL}/conseils/${current.id}`, payload)
      : this.http.post<Advice>(`${API_BASE_URL}/conseils`, payload);
    let draftSaved = false;
    saveRequest.pipe(
      tap((saved) => { draftSaved = true; this.selected.set(saved); }),
      switchMap((saved) => publish
        ? this.http.post<Advice>(`${API_BASE_URL}/conseils/${saved.id}/valider`, {}).pipe(
            switchMap(() => this.http.post<Advice>(`${API_BASE_URL}/conseils/${saved.id}/publier`, {})),
          )
        : of(saved)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.busy.set(false); this.editorOpen.set(false); this.notice.set(publish ? 'Conseil publié.' : 'Brouillon enregistré.'); this.load(); },
      error: (cause: unknown) => { this.busy.set(false); this.error.set(draftSaved && publish
        ? `Brouillon enregistré, mais publication impossible : ${this.describe(cause)}`
        : this.describe(cause)); },
    });
  }

  archive(): void {
    const item = this.pendingArchive();
    if (!item || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.http.post<Advice>(`${API_BASE_URL}/conseils/${item.id}/archiver`, {})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.busy.set(false); this.pendingArchive.set(null); this.editorOpen.set(false); this.notice.set('Conseil archivé.'); this.load(); },
        error: (cause: unknown) => { this.busy.set(false); this.error.set(this.describe(cause)); },
      });
  }
  restore(item: Advice): void {
    if (this.busy() || item.statut !== 'ARCHIVE') return;
    this.busy.set(true); this.error.set('');
    this.http.post<Advice>(`${API_BASE_URL}/conseils/${item.id}/desarchiver`, {})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.busy.set(false);
          this.notice.set('Conseil désarchivé et publié.');
          this.showingArchived.set(false);
          this.load();
        },
        error: (cause: unknown) => { this.busy.set(false); this.error.set(this.describe(cause)); },
      });
  }
  private describe(cause: unknown): string {
    if (cause instanceof HttpErrorResponse && typeof cause.error?.message === 'string') return cause.error.message;
    return 'Opération impossible. Réessayez.';
  }
}
