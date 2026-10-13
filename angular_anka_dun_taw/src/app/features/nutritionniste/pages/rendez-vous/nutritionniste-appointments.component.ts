import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BeneficiaryName, NutritionistAppointmentsDataAccess, ProfessionalAppointment } from '../../data-access/nutritionniste-appointments.data-access';

@Component({
  selector: 'app-nutritionniste-appointments',
  imports: [FormsModule, RouterLink],
  templateUrl: './nutritionniste-appointments.component.html',
  styleUrl: './nutritionniste-appointments.component.css',
})
export class NutritionnisteAppointmentsComponent {
  private readonly api = inject(NutritionistAppointmentsDataAccess);
  private readonly destroyRef = inject(DestroyRef);
  readonly appointments = signal<ProfessionalAppointment[]>([]);
  readonly beneficiaries = signal<BeneficiaryName[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly notice = signal('');
  readonly busyId = signal<number | null>(null);
  readonly refusalId = signal<number | null>(null);
  readonly view = signal<'day' | 'week'>('day');
  readonly selectedDate = signal(this.localDate(new Date()));
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  readonly timeLabel = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  refusalComment = '';
  readonly pending = computed(() => this.appointments().filter((item) => item.statut === 'DEMANDE').sort((a, b) => new Date(a.dateHeure).getTime() - new Date(b.dateHeure).getTime()));
  readonly schedule = computed(() => {
    const selected = new Date(`${this.selectedDate()}T00:00:00`);
    const begin = new Date(selected);
    if (this.view() === 'week') begin.setDate(begin.getDate() - ((begin.getDay() + 6) % 7));
    const end = new Date(begin);
    end.setDate(begin.getDate() + (this.view() === 'week' ? 7 : 1));
    return this.appointments().filter((item) => {
      const time = new Date(item.dateHeure).getTime();
      return item.statut === 'ACCEPTE' && time >= begin.getTime() && time < end.getTime();
    }).sort((a, b) => new Date(a.dateHeure).getTime() - new Date(b.dateHeure).getTime());
  });

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.api.appointments().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => { this.appointments.set(items); this.loading.set(false); },
      error: () => { this.error.set('Impossible de charger les rendez-vous.'); this.loading.set(false); },
    });
    this.api.beneficiaries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (items) => this.beneficiaries.set(items) });
  }
  setDate(event: Event): void { this.selectedDate.set((event.target as HTMLInputElement).value); }
  today(): void { this.selectedDate.set(this.localDate(new Date())); this.view.set('day'); }
  shift(delta: number): void {
    const date = new Date(`${this.selectedDate()}T00:00:00`);
    date.setDate(date.getDate() + delta * (this.view() === 'week' ? 7 : 1));
    this.selectedDate.set(this.localDate(date));
  }
  name(item: ProfessionalAppointment): string {
    const linked = this.beneficiaries().find((person) => person.id === item.utilisateurId);
    return [item.utilisateurPrenom || linked?.prenom, item.utilisateurNom || linked?.nom].filter(Boolean).join(' ') || `Patient n° ${item.utilisateurId}`;
  }
  initials(item: ProfessionalAppointment): string { return this.name(item).split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toLocaleUpperCase('fr'); }
  time(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : this.timeLabel.format(date); }
  date(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date indisponible' : this.dateLabel.format(date); }
  private localDate(date: Date): string {
    const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  accept(item: ProfessionalAppointment): void {
    if (this.busyId() !== null || item.statut !== 'DEMANDE') return;
    this.busyId.set(item.id); this.actionError.set('');
    this.api.accept(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.busyId.set(null); this.appointments.update((items) => items.map((row) => row.id === item.id ? updated : row)); this.notice.set('Rendez-vous accepté.'); },
      error: () => { this.busyId.set(null); this.actionError.set('Impossible d’accepter ce rendez-vous.'); },
    });
  }
  startRefusal(item: ProfessionalAppointment): void { this.refusalId.set(item.id); this.refusalComment = ''; this.actionError.set(''); }
  cancelRefusal(): void { if (this.busyId() === null) this.refusalId.set(null); }
  refuse(): void {
    const id = this.refusalId();
    if (!id || this.busyId() !== null) return;
    const comment = this.refusalComment.trim();
    if (!comment) { this.actionError.set('Indiquez le motif du refus.'); return; }
    this.busyId.set(id); this.actionError.set('');
    this.api.refuse(id, comment).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.busyId.set(null); this.refusalId.set(null); this.appointments.update((items) => items.map((row) => row.id === id ? updated : row)); this.notice.set('Rendez-vous refusé.'); },
      error: () => { this.busyId.set(null); this.actionError.set('Impossible de refuser ce rendez-vous.'); },
    });
  }
}
