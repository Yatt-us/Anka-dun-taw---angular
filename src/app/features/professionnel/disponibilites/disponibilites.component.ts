import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { API_BASE_URL } from '../../../core/config/api.config';

interface Availability { id: number; dateHeureDebut: string; dateHeureFin: string; statut: string }
interface ApiPage<T> { content: T[]; totalElements: number }

@Component({
  selector: 'app-disponibilites',
  imports: [FormsModule],
  templateUrl: './disponibilites.component.html',
  styleUrl: './disponibilites.component.css',
})
export class DisponibilitesComponent {
  private readonly http = inject(HttpClient);
  readonly slots = signal<Availability[]>([]);
  readonly page = signal(0);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly loadError = signal('');
  readonly success = signal('');
  start = '';
  end = '';
  editingId: number | null = null;

  constructor() { this.load(); }

  get minimumDateTime(): string {
    const minimum = new Date(Date.now() + 60_000);
    const local = new Date(minimum.getTime() - minimum.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.http.get<ApiPage<Availability>>(`${API_BASE_URL}/professionnel/disponibilites`, {
      params: new HttpParams().set('page', this.page()).set('size', 10),
    }).subscribe({
      next: (result) => { this.slots.set(result.content); this.total.set(result.totalElements); this.loading.set(false); },
      error: () => { this.loadError.set('Chargement des créneaux impossible.'); this.loading.set(false); },
    });
  }
  create(form: NgForm): void {
    this.error.set(''); this.success.set('');
    if (form.invalid || !this.start || !this.end) {
      form.control.markAllAsTouched();
      this.error.set('Renseignez une date et une heure de début et de fin.');
      return;
    }
    if (new Date(this.start).getTime() <= Date.now()) { this.error.set('Choisissez un début dans le futur.'); return; }
    if (new Date(this.end).getTime() <= new Date(this.start).getTime()) { this.error.set('La fin doit être après le début.'); return; }
    this.saving.set(true);
    const payload = {
      dateHeureDebut: this.start, dateHeureFin: this.end,
    };
    const request = this.editingId
      ? this.http.put(`${API_BASE_URL}/professionnel/disponibilites/${this.editingId}`, payload)
      : this.http.post(`${API_BASE_URL}/professionnel/disponibilites`, payload);
    request.subscribe({
      next: () => { const updated = this.editingId !== null; this.saving.set(false); this.resetForm(form); this.success.set(updated ? 'Créneau modifié.' : 'Créneau ajouté.'); this.page.set(0); this.load(); },
      error: (error: unknown) => { this.saving.set(false); this.error.set(this.describe(error)); },
    });
  }
  edit(slot: Availability, form: NgForm): void {
    if (this.saving() || slot.statut !== 'LIBRE') return;
    this.editingId = slot.id;
    this.start = this.toLocalInput(slot.dateHeureDebut);
    this.end = this.toLocalInput(slot.dateHeureFin);
    this.error.set(''); this.success.set('');
    form.control.markAsPristine();
  }
  cancelEdit(form: NgForm): void { this.resetForm(form); this.error.set(''); this.success.set(''); }
  private resetForm(form: NgForm): void { this.editingId = null; this.start = ''; this.end = ''; form.resetForm(); }
  private toLocalInput(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }
  remove(id: number): void {
    this.error.set(''); this.success.set(''); this.saving.set(true);
    this.http.delete(`${API_BASE_URL}/professionnel/disponibilites/${id}`).subscribe({
      next: () => {
        this.saving.set(false);
        const remaining = Math.max(0, this.total() - 1);
        this.total.set(remaining);
        if (this.page() > 0 && this.page() * 10 >= remaining) this.page.update((page) => page - 1);
        this.success.set('Créneau désactivé.');
        this.load();
      },
      error: (error: unknown) => { this.saving.set(false); this.error.set(this.describe(error)); },
    });
  }
  changePage(delta: number): void {
    const lastPage = Math.max(0, Math.ceil(this.total() / 10) - 1);
    this.page.update((value) => Math.min(lastPage, Math.max(0, value + delta)));
    this.load();
  }
  statusLabel(status: string): string {
    return ({ LIBRE: 'Disponible', RESERVEE: 'Réservé', INDISPONIBLE: 'Bloqué' } as Record<string, string>)[status] ?? status;
  }
  format(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Date indisponible'
      : new Intl.DateTimeFormat('fr-ML', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  private describe(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'La requête n’a pas abouti. Vérifiez votre connexion puis réessayez.';
    const payload = error.error as { message?: unknown; detail?: unknown; title?: unknown } | null;
    for (const candidate of [payload?.message, payload?.detail, payload?.title]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous puis réessayez.';
    if (error.status === 403) return 'Votre compte professionnel doit être actif et vérifié pour gérer les créneaux.';
    if (error.status === 409) return 'Ce créneau chevauche une disponibilité ou un rendez-vous existant.';
    if (error.status === 0) return 'Le serveur est injoignable. Vérifiez votre connexion puis réessayez.';
    return `L’ajout a échoué (erreur ${error.status}). Réessayez.`;
  }
}
