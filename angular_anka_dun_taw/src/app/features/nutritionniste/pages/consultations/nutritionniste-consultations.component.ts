import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { BeneficiaryName, NutritionistAppointmentsDataAccess, ProfessionalAppointment } from '../../data-access/nutritionniste-appointments.data-access';

type Filter = 'all' | 'DEMANDE' | 'ACCEPTE' | 'REFUSE';

@Component({
  selector: 'app-nutritionniste-consultations',
  imports: [FormsModule],
  templateUrl: './nutritionniste-consultations.component.html',
  styleUrl: './nutritionniste-consultations.component.css',
})
export class NutritionnisteConsultationsComponent {
  private readonly api = inject(NutritionistAppointmentsDataAccess);
  private readonly destroyRef = inject(DestroyRef);
  readonly appointments = signal<ProfessionalAppointment[]>([]);
  readonly beneficiaries = signal<BeneficiaryName[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly actionError = signal('');
  readonly busyId = signal<number | null>(null);
  readonly filter = signal<Filter>('all');
  readonly selectedId = signal<number | null>(null);
  readonly refusalId = signal<number | null>(null);
  readonly dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  refusalComment = '';
  readonly relevant = computed(() => this.appointments().filter((item) => ['DEMANDE', 'ACCEPTE', 'REFUSE'].includes(item.statut)));
  readonly visible = computed(() => this.relevant().filter((item) => this.filter() === 'all' || item.statut === this.filter()));
  readonly selected = computed(() => this.appointments().find((item) => item.id === this.selectedId()) ?? null);
  readonly pendingCount = computed(() => this.appointments().filter((item) => item.statut === 'DEMANDE').length);
  readonly acceptedCount = computed(() => this.appointments().filter((item) => item.statut === 'ACCEPTE').length);
  readonly refusedCount = computed(() => this.appointments().filter((item) => item.statut === 'REFUSE').length);

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set('');
    this.api.appointments().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.appointments.set(items);
        this.loading.set(false);
        if (this.selectedId() && !items.some((item) => item.id === this.selectedId())) this.selectedId.set(null);
      },
      error: () => { this.error.set('Impossible de charger les demandes de consultation.'); this.loading.set(false); },
    });
    this.api.beneficiaries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => this.beneficiaries.set(items),
    });
  }
  setFilter(value: Filter): void { this.filter.set(value); this.selectedId.set(null); }
  select(item: ProfessionalAppointment): void { this.selectedId.set(item.id); this.actionError.set(''); }
  name(item: ProfessionalAppointment): string {
    const linked = this.beneficiaries().find((person) => person.id === item.utilisateurId);
    return [item.utilisateurPrenom || linked?.prenom, item.utilisateurNom || linked?.nom].filter(Boolean).join(' ') || `Patient n° ${item.utilisateurId}`;
  }
  initials(item: ProfessionalAppointment): string { return this.name(item).split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toLocaleUpperCase('fr'); }
  status(item: ProfessionalAppointment): string { return item.statut === 'DEMANDE' ? 'En attente' : item.statut === 'ACCEPTE' ? 'Acceptée' : 'Refusée'; }
  date(item: ProfessionalAppointment): string {
    const parsed = new Date(item.dateHeure);
    return Number.isNaN(parsed.getTime()) ? 'Date indisponible' : this.dateFormat.format(parsed);
  }
  accept(item: ProfessionalAppointment): void {
    if (this.busyId() !== null || item.statut !== 'DEMANDE') return;
    this.busyId.set(item.id); this.actionError.set('');
    this.api.accept(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.busyId.set(null); this.appointments.update((items) => items.map((row) => row.id === item.id ? updated : row)); this.notice.set('Demande acceptée.'); },
      error: () => { this.busyId.set(null); this.actionError.set('Acceptation impossible. Réessayez.'); },
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
      next: (updated) => { this.busyId.set(null); this.refusalId.set(null); this.appointments.update((items) => items.map((row) => row.id === id ? updated : row)); this.notice.set('Demande refusée.'); },
      error: () => { this.busyId.set(null); this.actionError.set('Refus impossible. Réessayez.'); },
    });
  }
}
