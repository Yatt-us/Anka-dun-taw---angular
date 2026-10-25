import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiPage, WorkspacePageResult, WorkspaceRow } from '../../../shared/models/workspace-list.models';
import { currencyLabel, formatApiDate, formatStatusLabel, fullPersonName, shortSummary, statusBadge } from '../../../shared/utils/workspace-formatters';
import { WorkspaceAction } from '../../../shared/models/workspace-list.models';
import { EditorKind } from '../../../shared/forms/workspace-editor.service';

interface Menu { id: number; titre: string; description?: string; imageUrl?: string | null; type?: string; dateDebut?: string; dateFin?: string; statut?: string; beneficiaireIds?: number[]; coutTotalEstime?: number; devise?: string }
interface Recipe { id: number; nom: string; description?: string; imageUrl?: string | null; dureePreparationMinutes?: number; nombrePersonnes?: number; statut?: string }
interface Appointment { id: number; utilisateurId?: number; dateHeure?: string; motif?: string; mode?: string; statut?: string }
interface Person { id: number; nom?: string; prenom?: string; email?: string; specialite?: string; qualification?: string; statutVerification?: string }
interface Conversation { id: number; interlocuteurNom?: string; interlocuteurPrenom?: string; dernierMessage?: string; dernierMessageA?: string; messagesNonLus?: number }

@Injectable({ providedIn: 'root' })
export class DieteticienWorkspaceDataAccess {
  private readonly http = inject(HttpClient);

  load(section: string, page: number, size: number): Observable<WorkspacePageResult> | null {
    switch (section) {
      case 'menus': return this.paged<Menu>('/professionnel/menus', page, size, (item) => ({
        key: `menu-${item.id}`, title: item.titre, data: { ...item }, imageUrl: item.imageUrl,
        subtitle: [item.type ? formatStatusLabel(item.type) : null, item.beneficiaireIds?.length != null ? `${item.beneficiaireIds.length} bénéficiaire(s)` : null].filter(Boolean).join(' · ') || shortSummary(item.description),
        value: [item.dateDebut ? `Du ${formatApiDate(item.dateDebut)}` : null, item.dateFin ? `au ${formatApiDate(item.dateFin)}` : null, item.coutTotalEstime == null ? null : `${item.coutTotalEstime} ${currencyLabel(item.devise)}`].filter(Boolean).join(' · ') || shortSummary(item.description),
        ...statusBadge(item.statut),
        detail: item.statut === 'BROUILLON' || item.statut === 'EN_VALIDATION' ? { editKind: 'menu' } : undefined,
      }));
      case 'recettes': return this.paged<Recipe>('/recettes', page, size, (item) => ({
        key: `recipe-${item.id}`, title: item.nom, subtitle: shortSummary(item.description), imageUrl: item.imageUrl,
        value: [item.dureePreparationMinutes == null ? null : `${item.dureePreparationMinutes} min`, item.nombrePersonnes == null ? null : `${item.nombrePersonnes} personne(s)`].filter(Boolean).join(' · ') || 'Préparation non renseignée',
        ...statusBadge(item.statut),
      }));
      case 'rendez-vous': return this.appointments(page, size);
      case 'messages': return this.conversations(page, size);
      case 'profil': return this.profile();
      default: return null;
    }
  }

  createKinds(section: string): EditorKind[] {
    if (section === 'menus') return ['menu'];
    if (section === 'profil') return ['profile'];
    return [];
  }

  actionsFor(key: string, badge: string, id: number): WorkspaceAction[] {
    if (key.startsWith('menu-')) {
      if (badge === 'Brouillon' || badge === 'En validation') return [{ label: 'Valider', path: `/professionnel/menus/${id}/valider` }];
      if (badge === 'Validé') return [{ label: 'Publier', path: `/professionnel/menus/${id}/publier` }];
    }
    if (key.startsWith('appointment-')) {
      if (badge === 'Demandé') return [
        { label: 'Accepter', path: `/professionnel/rendez-vous/${id}/accepter` },
        { label: 'Refuser', path: `/professionnel/rendez-vous/${id}/refuser`, comment: true },
      ];
      if (badge === 'Accepté') return [{ label: 'Terminer', path: `/professionnel/rendez-vous/${id}/terminer` }];
    }
    return [];
  }

  private paged<T>(path: string, page: number, size: number, toRow: (item: T) => WorkspaceRow): Observable<WorkspacePageResult> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiPage<T>>(`${API_BASE_URL}${path}`, { params }).pipe(
      map((result) => ({ rows: result.content.map(toRow), total: result.totalElements })),
    );
  }

  private appointments(page: number, size: number): Observable<WorkspacePageResult> {
    return this.paged<Appointment>('/professionnel/rendez-vous', page, size, (item) => ({
      key: `appointment-${item.id}`,
      title: item.utilisateurId == null ? `Rendez-vous n° ${item.id}` : `Patient n° ${item.utilisateurId}`,
      subtitle: item.motif || 'Motif non renseigné',
      value: [formatApiDate(item.dateHeure), item.mode ? formatStatusLabel(item.mode) : null].filter(Boolean).join(' · '),
      ...statusBadge(item.statut),
      detail: item.statut === 'DEMANDE' ? {
        kind: 'appointment', showAppointmentComment: true, commentLabel: 'Motif du refus (si nécessaire)',
      } : undefined,
    }));
  }

  private profile(): Observable<WorkspacePageResult> {
    return this.http.get<Person>(`${API_BASE_URL}/professionnels/me`).pipe(map((item) => ({
      rows: [{
        key: `professional-${item.id}`, title: fullPersonName(item),
        subtitle: [item.specialite, item.qualification].filter(Boolean).join(' · ') || 'Spécialité non renseignée',
        value: item.email || 'Adresse e-mail non renseignée', ...statusBadge(item.statutVerification),
      }], total: 1,
    })));
  }

  private conversations(page: number, size: number): Observable<WorkspacePageResult> {
    return this.http.get<Conversation[]>(`${API_BASE_URL}/professionnel/messagerie/conversations`).pipe(map((items) => {
      const rows = items.map((item): WorkspaceRow => ({
        key: `conversation-${item.id}`,
        title: fullPersonName({ prenom: item.interlocuteurPrenom, nom: item.interlocuteurNom }),
        subtitle: shortSummary(item.dernierMessage), value: formatApiDate(item.dernierMessageA),
        badge: item.messagesNonLus ? `${item.messagesNonLus} non lu(s)` : 'Lu',
        badgeTone: item.messagesNonLus ? 'orange' : 'green',
        detail: { kind: 'conversation', showConversation: true },
      }));
      return { rows: rows.slice(page * size, (page + 1) * size), total: rows.length,
        hint: 'Cette section affiche les conversations avec les patients.' };
    }));
  }
}
