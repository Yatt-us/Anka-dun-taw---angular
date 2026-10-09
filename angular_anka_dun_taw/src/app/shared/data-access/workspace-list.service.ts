import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminWorkspaceDataAccess } from '../../features/admin/data-access/admin-workspace.data-access';
import { DieteticienWorkspaceDataAccess } from '../../features/dieteticien/data-access/dieteticien-workspace.data-access';
import { NutritionnisteWorkspaceDataAccess } from '../../features/nutritionniste/data-access/nutritionniste-workspace.data-access';
import { ActorId } from '../components/workspace-config';
import { FoodPrice, ProfessionalMessage, WorkspaceAction, WorkspacePageResult, WorkspaceRow } from '../models/workspace-list.models';
import { NotificationListDataAccess } from './notification-list.data-access';
import { EditorKind } from '../forms/workspace-editor.service';
import { ProfessionalMessagingDataAccess } from '../../features/professionnel/data-access/professional-messaging.data-access';

export type { WorkspacePageResult, WorkspaceRow } from '../models/workspace-list.models';

/**
 * Shared routing adapter. Feature-owned data access classes keep their own API
 * endpoints and DTO mapping; this class only forwards the selected section.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceListService {
  private readonly admin = inject(AdminWorkspaceDataAccess);
  private readonly dieteticien = inject(DieteticienWorkspaceDataAccess);
  private readonly nutritionniste = inject(NutritionnisteWorkspaceDataAccess);
  private readonly notifications = inject(NotificationListDataAccess);
  private readonly messaging = inject(ProfessionalMessagingDataAccess);

  load(actor: ActorId, section: string, page: number, size: number, status = ''): Observable<WorkspacePageResult> | null {
    if (section === 'notifications') return this.notifications.load(page, size);
    switch (actor) {
      case 'admin': return this.admin.load(section, page, size, status);
      case 'dieteticien': return this.dieteticien.load(section, page, size);
      case 'nutritionniste': return this.nutritionniste.load(section, page, size);
    }
  }

  createKinds(actor: ActorId, section: string): EditorKind[] {
    switch (actor) {
      case 'admin': return this.admin.createKinds(section);
      case 'dieteticien': return this.dieteticien.createKinds(section);
      case 'nutritionniste': return this.nutritionniste.createKinds(section);
    }
  }

  actionsFor(actor: ActorId, key: string, badge: string, id: number): WorkspaceAction[] {
    if (key.startsWith('notification-') && badge === 'À lire') {
      return [{ label: 'Marquer comme lue', path: `/me/notifications/${id}/lire` }];
    }
    switch (actor) {
      case 'admin': return this.admin.actionsFor(key, badge, id);
      case 'dieteticien': return this.dieteticien.actionsFor(key, badge, id);
      case 'nutritionniste': return this.nutritionniste.actionsFor(key, badge, id);
    }
  }

  supportsStatusFilter(actor: ActorId, section: string): boolean {
    return actor === 'admin' && ['menus', 'quiz', 'defis'].includes(section);
  }

  statusFilterOptions(section: string): Array<{ value: string; label: string }> {
    const options = [
      { value: '', label: 'Tous' },
      { value: 'BROUILLON', label: 'Brouillons' },
    ];
    if (section === 'menus') options.push({ value: 'EN_VALIDATION', label: 'En validation' }, { value: 'VALIDE', label: 'Validés' });
    options.push({ value: 'PUBLIE', label: 'Publiés' }, { value: 'ARCHIVE', label: 'Archivés' });
    return options;
  }

  recordLabel(actor: ActorId): string { return actor === 'admin' ? 'Élément' : 'Dossier'; }

  foodPrices(foodId: number): Observable<FoodPrice[]> { return this.admin.foodPrices(foodId); }

  advanceChallenge(challengeId: number, userId: number, progress: number): Observable<unknown> {
    return this.admin.advanceChallenge(challengeId, userId, progress);
  }

  messages(conversationId: number, page: number, size: number): Observable<{ content: ProfessionalMessage[]; totalElements: number }> {
    return this.messaging.messages(conversationId, page, size);
  }

  reply(conversationId: number, content: string): Observable<unknown> {
    return this.messaging.reply(conversationId, content);
  }
}
