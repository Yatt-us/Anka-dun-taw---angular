import { DatePipe } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { ProfessionalMessage } from '../../../../shared/models/workspace-list.models';
import { ProfessionalMessagingDataAccess } from '../../../professionnel/data-access/professional-messaging.data-access';
import { NutritionistDashboardApi, ProfessionalConversation } from '../../data-access/nutritionniste-dashboard.data-access';

@Component({
  selector: 'app-nutritionniste-questions',
  imports: [DatePipe, A11yModule, UiIconComponent],
  templateUrl: './nutritionniste-questions.component.html',
  styleUrl: './nutritionniste-questions.component.css',
})
export class NutritionnisteQuestionsComponent {
  private readonly api = inject(NutritionistDashboardApi);
  private readonly messaging = inject(ProfessionalMessagingDataAccess);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  readonly conversations = signal<ProfessionalConversation[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly search = signal('');
  readonly filter = signal<'all' | 'unread'>('all');
  readonly selected = signal<ProfessionalConversation | null>(null);
  readonly requestedPatientId = signal<number | null>(null);
  readonly messages = signal<ProfessionalMessage[]>([]);
  readonly messagesLoading = signal(false);
  readonly messagesError = signal(false);
  readonly reply = signal('');
  readonly sending = signal(false);
  readonly sendError = signal('');
  readonly filtered = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('fr');
    return this.conversations().filter((conversation) => {
      const name = this.name(conversation).toLocaleLowerCase('fr');
      const content = (conversation.dernierMessage || '').toLocaleLowerCase('fr');
      return (this.filter() === 'all' || conversation.messagesNonLus > 0)
        && (!query || name.includes(query) || content.includes(query));
    });
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const patientId = Number(params.get('patient'));
      this.requestedPatientId.set(Number.isInteger(patientId) && patientId > 0 ? patientId : null);
      this.selectRequestedConversation(Number(params.get('conversation')));
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.conversations().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.conversations.set([...items].sort((a, b) => (b.dernierMessageA || '').localeCompare(a.dernierMessageA || '')));
        this.loading.set(false);
        this.selectRequestedConversation(Number(this.route.snapshot.queryParamMap.get('conversation')));
      },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  name(item: ProfessionalConversation): string {
    return [item.interlocuteurPrenom, item.interlocuteurNom].filter(Boolean).join(' ') || `Utilisateur n° ${item.interlocuteurId}`;
  }
  hasRequestedPatientConversation(): boolean {
    const patientId = this.requestedPatientId();
    return patientId != null && this.conversations().some((item) => item.interlocuteurId === patientId);
  }
  initials(item: ProfessionalConversation): string {
    return [item.interlocuteurPrenom, item.interlocuteurNom].filter(Boolean).map((part) => part![0].toLocaleUpperCase('fr')).join('') || '?';
  }
  setSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  setFilter(event: Event): void { this.filter.set((event.target as HTMLSelectElement).value === 'unread' ? 'unread' : 'all'); }
  setReply(event: Event): void { this.reply.set((event.target as HTMLTextAreaElement).value); }

  select(item: ProfessionalConversation): void {
    this.selected.set(item);
    this.reply.set('');
    this.sendError.set('');
    this.loadMessages(item.id);
  }
  close(): void { this.selected.set(null); }

  private selectRequestedConversation(conversationId: number): void {
    const conversations = this.conversations();
    if (!conversations.length) return;
    const byConversation = conversations.find((item) => item.id === conversationId);
    const patientId = this.requestedPatientId();
    const byPatient = patientId == null ? undefined : conversations.find((item) => item.interlocuteurId === patientId);
    const target = byConversation || byPatient;
    if (target && this.selected()?.id !== target.id) this.select(target);
    else if (!target) this.selected.set(null);
  }

  private loadMessages(id: number): void {
    this.messagesLoading.set(true);
    this.messagesError.set(false);
    this.messaging.messages(id, 0, 100).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        if (this.selected()?.id !== id) return;
        this.messages.set(page.content);
        this.messagesLoading.set(false);
        // Le GET marque les messages reçus comme lus côté serveur ; refléter ce statut dans la liste.
        this.conversations.update((items) => items.map((item) => item.id === id
          ? { ...item, messagesNonLus: 0 }
          : item));
      },
      error: () => { if (this.selected()?.id === id) { this.messagesError.set(true); this.messagesLoading.set(false); } },
    });
  }

  isOwn(message: ProfessionalMessage): boolean {
    const own = this.auth.currentUser();
    if (!own) return false;
    // L'identifiant est stable, contrairement aux noms qui peuvent être identiques.
    return message.auteurId != null
      ? message.auteurId === own.id
      : message.auteurNom === own.nom && message.auteurPrenom === own.prenom;
  }

  send(): void {
    const item = this.selected();
    const content = this.reply().trim();
    if (!item || !content || this.sending()) return;
    this.sending.set(true);
    this.sendError.set('');
    this.messaging.reply(item.id, content).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.sending.set(false);
        this.reply.set('');
        this.loadMessages(item.id);
        this.load();
      },
      error: () => { this.sending.set(false); this.sendError.set('Réponse non envoyée. Réessayez.'); },
    });
  }
}
