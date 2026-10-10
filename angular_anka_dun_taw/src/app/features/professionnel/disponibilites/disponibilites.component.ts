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
  readonly success = signal('');
  start = '';
  end = '';

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.http.get<ApiPage<Availability>>(`${API_BASE_URL}/professionnel/disponibilites`, {
      params: new HttpParams().set('page', this.page()).set('size', 10),
    }).subscribe({
      next: (result) => { this.slots.set(result.content); this.total.set(result.totalElements); this.loading.set(false); },
      error: () => { this.error.set('Chargement des créneaux impossible.'); this.loading.set(false); },
    });
  }
  create(form: NgForm): void {
    this.error.set(''); this.success.set('');
    if (form.invalid || !this.start || !this.end) { form.control.markAllAsTouched(); return; }
    if (new Date(this.start) <= new Date()) { this.error.set('Choisissez un début dans le futur.'); return; }
    if (new Date(this.end) <= new Date(this.start)) { this.error.set('La fin doit être après le début.'); return; }
    this.saving.set(true);
    this.http.post(`${API_BASE_URL}/professionnel/disponibilites`, {
      dateHeureDebut: this.start, dateHeureFin: this.end,
    }).subscribe({
      next: () => { this.saving.set(false); this.start = ''; this.end = ''; this.success.set('Créneau ajouté.'); this.page.set(0); this.load(); },
      error: (error: unknown) => { this.saving.set(false); this.error.set(this.describe(error)); },
    });
  }
  remove(id: number): void {
    this.error.set(''); this.success.set(''); this.saving.set(true);
    this.http.delete(`${API_BASE_URL}/professionnel/disponibilites/${id}`).subscribe({
      next: () => { this.saving.set(false); this.success.set('Créneau retiré.'); this.load(); },
      error: (error: unknown) => { this.saving.set(false); this.error.set(this.describe(error)); },
    });
  }
  changePage(delta: number): void { this.page.update((value) => value + delta); this.load(); }
  format(value: string): string { return new Intl.DateTimeFormat('fr-ML', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  private describe(error: unknown): string {
    return error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
      ? error.error.message : 'Action impossible. Réessayez.';
  }
}
