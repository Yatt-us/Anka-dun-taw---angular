import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  AdaptationRequest,
  DietitianBeneficiary,
  DietitianDashboardApi,
  DietitianMenu,
  ProfessionalAppointment,
} from '../../data-access/dieteticien-dashboard.data-access';

@Component({
  selector: 'app-dieteticien-dashboard',
  imports: [MatCardModule, MatButtonModule, RouterLink, UiIconComponent],
  templateUrl: './dieteticien-dashboard.component.html',
  styleUrls: ['../../../../shared/components/dashboard.css', './dieteticien-dashboard.component.css'],
})
export class DieteticienDashboardComponent implements OnInit {
  private readonly api = inject(DietitianDashboardApi);
  private readonly auth = inject(AuthService);
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
  readonly beneficiaries = signal<DietitianBeneficiary[]>([]);
  readonly beneficiariesCount = signal<number | null>(null);
  readonly beneficiariesError = signal(false);
  readonly adaptations = signal<AdaptationRequest[] | null>(null);
  readonly appointments = signal<ProfessionalAppointment[] | null>(null);
  readonly menusError = signal(false);
  readonly adaptationsError = signal(false);
  readonly appointmentsError = signal(false);
  readonly displayName = computed(() => {
    const user = this.auth.currentUser();
    return user ? [user.prenom, user.nom].filter(Boolean).join(' ') : 'cher professionnel';
  });

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
    const beneficiaries = this.beneficiariesCount();
    return [
      {
        label: 'Mes patients actifs',
        value: this.value(beneficiaries ?? undefined, this.beneficiariesError()),
        detail: this.beneficiariesError() ? 'Données indisponibles' : 'Patients liés à votre espace',
        icon: 'users',
        tone: '',
      },
      {
        label: 'Menus à créer ou valider',
        value: this.value(
          menus?.filter((menu) => menu.statut === 'BROUILLON' || menu.statut === 'EN_VALIDATION').length,
          this.menusError(),
        ),
        detail: this.menusError() ? 'Données indisponibles' : 'Brouillons et validations',
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
        label: 'Menus publiés',
        value: this.value(menus?.filter((menu) => menu.statut === 'PUBLIE').length, this.menusError()),
        detail: this.menusError() ? 'Données indisponibles' : 'Disponibles pour les patients',
        icon: 'chart',
        tone: '',
      },
    ];
  });

  ngOnInit(): void {
    this.api.beneficiaries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (patients) => { this.beneficiaries.set(patients); this.beneficiariesCount.set(patients.length); },
      error: () => this.beneficiariesError.set(true),
    });
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

  patientName(id: number): string {
    const patient = this.beneficiaries().find((item) => item.id === id);
    return patient ? [patient.prenom, patient.nom].filter(Boolean).join(' ') || `Patient n° ${id}` : `Patient n° ${id}`;
  }

  patientPhoto(id: number): string | null {
    return this.beneficiaries().find((item) => item.id === id)?.photoProfilUrl || null;
  }

  hideBrokenImage(event: Event): void {
    (event.target as HTMLImageElement).remove();
  }

  appointmentTime(dateTime: string): string {
    return dateTime?.slice(11, 16).replace(':', 'h') || '—';
  }

  private value(count: number | undefined, failed: boolean): string {
    return count === undefined ? (failed ? '—' : '…') : this.numberFormat.format(count);
  }
}
