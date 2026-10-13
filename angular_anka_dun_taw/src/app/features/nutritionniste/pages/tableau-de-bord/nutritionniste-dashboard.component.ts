import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import {
  NutritionistAppointment,
  NutritionistDashboardApi,
  ProfessionalConversation,
  BeneficiarySummary,
} from '../../data-access/nutritionniste-dashboard.data-access';

@Component({
  selector: 'app-nutritionniste-dashboard',
  imports: [DatePipe, MatCardModule, MatButtonModule, RouterLink, UiIconComponent],
  templateUrl: './nutritionniste-dashboard.component.html',
  styleUrls: ['../../../../shared/components/dashboard.css', './nutritionniste-dashboard.component.css'],
})
export class NutritionnisteDashboardComponent implements OnInit {
  private readonly api = inject(NutritionistDashboardApi);
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

  readonly conversations = signal<ProfessionalConversation[] | null>(null);
  readonly requestedCount = signal<number | null>(null);
  readonly appointments = signal<NutritionistAppointment[] | null>(null);
  readonly beneficiaries = signal<BeneficiarySummary[]>([]);
  readonly conversationsError = signal(false);
  readonly requestedError = signal(false);
  readonly appointmentsError = signal(false);
  readonly greeting = computed(() => {
    const user = this.auth.currentUser();
    return user ? `Bonjour, ${[user.prenom, user.nom].filter(Boolean).join(' ')}` : 'Bonjour';
  });

  readonly todayAppointments = computed(() => {
    const appointments = this.appointments();
    if (!appointments) return null;
    return appointments
      .filter((appointment) => appointment.dateHeure?.slice(0, 10) === this.todayKey)
      .sort((a, b) => a.dateHeure.localeCompare(b.dateHeure));
  });
  readonly metrics = computed(() => [
    {
      label: 'Questions en attente',
      value: this.value(
        this.conversations()?.reduce(
          (total, conversation) => total + conversation.messagesNonLus,
          0,
        ),
        this.conversationsError(),
      ),
      detail: this.conversationsError() ? 'Données indisponibles' : 'Messages non lus',
      icon: 'mail',
      tone: '',
    },
    {
      label: 'Demandes de consultation',
      value: this.value(this.requestedCount(), this.requestedError()),
      detail: this.requestedError() ? 'Données indisponibles' : 'Nouvelles demandes',
      icon: 'book',
      tone: 'orange',
    },
    {
      label: 'Rendez-vous aujourd’hui',
      value: this.value(this.todayAppointments()?.length, this.appointmentsError()),
      detail: this.appointmentsError() ? 'Données indisponibles' : 'Sessions prévues',
      icon: 'calendar',
      tone: 'yellow',
    },
  ]);

  ngOnInit(): void {
    this.api
      .conversations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (conversations) => this.conversations.set(conversations),
        error: () => this.conversationsError.set(true),
      });
    this.api
      .requestedAppointments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.requestedCount.set(page.totalElements),
        error: () => this.requestedError.set(true),
      });
    this.api
      .acceptedAppointments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appointments) => this.appointments.set(appointments),
        error: () => this.appointmentsError.set(true),
      });
    this.api.beneficiaries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => this.beneficiaries.set(page.content),
    });
  }

  conversationName(conversation: ProfessionalConversation): string {
    const name = [conversation.interlocuteurPrenom, conversation.interlocuteurNom]
      .filter(Boolean)
      .join(' ');
    return name || `Utilisateur #${conversation.interlocuteurId}`;
  }

  initials(conversation: ProfessionalConversation): string {
    const names = [conversation.interlocuteurPrenom, conversation.interlocuteurNom].filter(Boolean);
    return names.length ? names.map((name) => name!.charAt(0).toUpperCase()).join('') : '#';
  }

  appointmentTime(dateTime: string): string {
    return dateTime?.slice(11, 16).replace(':', 'h') || '—';
  }

  appointmentName(id: number): string {
    const beneficiary = this.beneficiaries().find((person) => person.id === id);
    return beneficiary ? [beneficiary.prenom, beneficiary.nom].filter(Boolean).join(' ') : `Patient n° ${id}`;
  }

  private value(count: number | null | undefined, failed: boolean): string {
    return count == null ? (failed ? '—' : '…') : this.numberFormat.format(count);
  }
}
