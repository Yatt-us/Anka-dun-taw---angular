import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import {
  AdaptationRequest,
  DietitianDashboardApi,
  DietitianMenu,
  ProfessionalAppointment,
} from '../../data-access/dieteticien-dashboard.data-access';

@Component({
  selector: 'app-dieteticien-dashboard',
  imports: [MatCardModule, MatButtonModule, RouterLink, UiIconComponent],
  templateUrl: './dieteticien-dashboard.component.html',
  styleUrl: '../../../../shared/components/dashboard.css',
})
export class DieteticienDashboardComponent implements OnInit {
  private readonly api = inject(DietitianDashboardApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly numberFormat = new Intl.NumberFormat('fr-FR');
  private readonly today = new Date();
  private readonly todayKey = [
    this.today.getFullYear(),
    String(this.today.getMonth() + 1).padStart(2, '0'),
    String(this.today.getDate()).padStart(2, '0'),
  ].join('-');

  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(this.today);

  readonly menus = signal<DietitianMenu[] | null>(null);
  readonly adaptations = signal<AdaptationRequest[] | null>(null);
  readonly appointments = signal<ProfessionalAppointment[] | null>(null);
  readonly menusError = signal(false);
  readonly adaptationsError = signal(false);
  readonly appointmentsError = signal(false);
  readonly showAdaptationsList = signal(false);
  readonly showAppointmentsList = signal(false);

  readonly pendingAdaptations = computed(
    () => this.adaptations()?.filter((request) => request.statut === 'EN_ATTENTE') ?? null,
  );
  readonly todayAppointments = computed(() => {
    const appointments = this.appointments();
    if (!appointments) return null;
    return appointments
      .filter(
        (appointment) =>
          appointment.dateHeure?.slice(0, 10) === this.todayKey &&
          appointment.statut !== 'REFUSE' &&
          appointment.statut !== 'ANNULE',
      )
      .sort((a, b) => a.dateHeure.localeCompare(b.dateHeure));
  });

  readonly metrics = computed(() => {
    const menus = this.menus();
    const requests = this.pendingAdaptations();
    const beneficiaries = menus
      ? new Set(menus.flatMap((menu) => menu.beneficiaireIds ?? [])).size
      : undefined;
    return [
      {
        label: 'Bénéficiaires de mes menus',
        value: this.value(beneficiaries, this.menusError()),
        detail: this.menusError() ? 'Données indisponibles' : 'Personnes associées à mes menus',
        icon: 'users',
        tone: '',
      },
      {
        label: 'Menus en validation',
        value: this.value(
          menus?.filter((menu) => menu.statut === 'EN_VALIDATION').length,
          this.menusError(),
        ),
        detail: this.menusError() ? 'Données indisponibles' : 'Statut en validation',
        icon: 'book',
        tone: 'orange',
      },
      {
        label: 'Demandes d’adaptation',
        value: this.value(requests?.length, this.adaptationsError()),
        detail: this.adaptationsError() ? 'Données indisponibles' : 'En attente de traitement',
        icon: 'refresh',
        tone: 'yellow',
      },
      {
        label: 'Taux de réussite',
        value: '—',
        detail: 'Indicateur indisponible',
        icon: 'chart',
        tone: '',
      },
    ];
  });

  toggleAdaptationsList(): void { this.showAdaptationsList.update((visible) => !visible); }
  toggleAppointmentsList(): void { this.showAppointmentsList.update((visible) => !visible); }

  ngOnInit(): void {
    this.api
      .menus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (menus) => {
          this.menus.set(menus);
          this.api
            .adaptations(menus)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (requests) => this.adaptations.set(requests),
              error: () => this.adaptationsError.set(true),
            });
        },
        error: () => {
          this.menusError.set(true);
          this.adaptationsError.set(true);
        },
      });

    this.api
      .appointments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appointments) => this.appointments.set(appointments),
        error: () => this.appointmentsError.set(true),
      });
  }

  menuTitle(menuId: number): string {
    return this.menus()?.find((menu) => menu.id === menuId)?.titre || `Menu #${menuId}`;
  }

  appointmentTime(dateTime: string): string {
    return dateTime?.slice(11, 16).replace(':', 'h') || '—';
  }

  private value(count: number | undefined, failed: boolean): string {
    return count === undefined ? (failed ? '—' : '…') : this.numberFormat.format(count);
  }
}
