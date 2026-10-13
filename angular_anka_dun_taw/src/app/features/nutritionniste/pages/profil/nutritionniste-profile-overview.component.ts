import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, expand, reduce } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import type { ProfessionalProfile } from '../../../professionnel/pages/profil/professional-profile.component';
import { NutritionistAppointmentsDataAccess } from '../../data-access/nutritionniste-appointments.data-access';

interface Availability { id: number; dateHeureDebut: string; dateHeureFin: string; statut: 'LIBRE' | 'RESERVEE' | 'INDISPONIBLE' }
interface Advice { id: number; statut: string }
interface Page<T> { content: T[]; number: number; totalPages: number }

@Component({
  selector: 'app-nutritionniste-profile-overview',
  imports: [RouterLink],
  templateUrl: './nutritionniste-profile-overview.component.html',
  styleUrl: './nutritionniste-profile-overview.component.css',
})
export class NutritionnisteProfileOverviewComponent {
  private readonly http = inject(HttpClient);
  private readonly appointmentsApi = inject(NutritionistAppointmentsDataAccess);
  private readonly destroyRef = inject(DestroyRef);
  readonly profile = input.required<ProfessionalProfile>();
  readonly edit = output<void>();
  readonly consultations = signal<number | null>(null);
  readonly patients = signal<number | null>(null);
  readonly publishedAdvice = signal<number | null>(null);
  readonly available = signal<Availability[]>([]);
  readonly availableCount = signal<number | null>(null);
  readonly availabilityLoading = signal(true);
  readonly availabilityError = signal(false);
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  readonly timeLabel = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

  constructor() { this.load(); }

  load(): void {
    this.appointmentsApi.appointments().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => this.consultations.set(items.filter((item) => item.statut === 'TERMINE').length),
    });
    this.appointmentsApi.beneficiaries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => this.patients.set(items.length),
    });
    const advicePage = (number: number) => this.http.get<Page<Advice>>(`${API_BASE_URL}/conseils/mes-conseils`, {
      params: new HttpParams().set('page', number).set('size', 100),
    });
    advicePage(0).pipe(
      expand((page) => page.number + 1 < page.totalPages ? advicePage(page.number + 1) : EMPTY),
      reduce((all, page) => all.concat(page.content), [] as Advice[]),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({ next: (items) => this.publishedAdvice.set(items.filter((item) => item.statut === 'PUBLIE').length) });
    const availabilityPage = (number: number) => this.http.get<Page<Availability>>(`${API_BASE_URL}/professionnel/disponibilites`, {
      params: new HttpParams().set('page', number).set('size', 100).set('sort', 'dateHeureDebut,asc'),
    });
    availabilityPage(0).pipe(
      expand((page) => page.number + 1 < page.totalPages ? availabilityPage(page.number + 1) : EMPTY),
      reduce((all, page) => all.concat(page.content), [] as Availability[]),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (items) => {
        const future = items.filter((item) => item.statut === 'LIBRE' && new Date(item.dateHeureDebut).getTime() > Date.now());
        this.available.set(future.slice(0, 5));
        this.availableCount.set(future.length);
        this.availabilityLoading.set(false);
      },
      error: () => { this.availabilityError.set(true); this.availabilityLoading.set(false); },
    });
  }
  name(): string { return [this.profile().prenom, this.profile().nom].filter(Boolean).join(' ') || 'Mon profil'; }
  initials(): string { return [this.profile().prenom?.[0], this.profile().nom?.[0]].filter(Boolean).join('').toLocaleUpperCase('fr') || 'P'; }
  specialities(): string[] { return (this.profile().specialite || '').split(/[,;]+/).map((value) => value.trim()).filter(Boolean); }
  formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date indisponible' : this.dateLabel.format(date); }
  formatTime(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : this.timeLabel.format(date); }
  hideBrokenImage(event: Event): void { (event.target as HTMLImageElement).remove(); }
}
