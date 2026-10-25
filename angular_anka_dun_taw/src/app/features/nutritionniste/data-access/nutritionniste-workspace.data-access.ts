import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiPage, WorkspacePageResult, WorkspaceRow } from '../../../shared/models/workspace-list.models';
import { formatApiDate, formatStatusLabel, fullPersonName, shortSummary, statusBadge } from '../../../shared/utils/workspace-formatters';
import { WorkspaceAction } from '../../../shared/models/workspace-list.models';
import { EditorKind } from '../../../shared/forms/workspace-editor.service';

interface Appointment { id: number; utilisateurId?: number; dateHeure?: string; motif?: string; mode?: string; statut?: string }
interface Person { id: number; nom?: string; prenom?: string; email?: string; specialite?: string; qualification?: string; statutVerification?: string }
interface Conversation { id: number; interlocuteurNom?: string; interlocuteurPrenom?: string; dernierMessage?: string; dernierMessageA?: string; messagesNonLus?: number }
interface Advice { id: number; titre: string; contenu?: string; imageUrl?: string | null; categorie?: string; statut?: string; validateurId?: number | null }
interface Article { id: number; titre: string; contenu?: string; imageUrl?: string | null; theme?: string; statut?: string }

@Injectable({ providedIn: 'root' })
export class NutritionnisteWorkspaceDataAccess {
  private readonly http = inject(HttpClient);

  load(section: string, page: number, size: number): Observable<WorkspacePageResult> | null {
    switch (section) {
      case 'recommandations': return this.myContent(page, size);
      case 'consultations': return this.appointments(page, size, 'DEMANDE');
      case 'rendez-vous': return this.appointments(page, size);
      case 'questions': return this.conversations(page, size);
      case 'profil': return this.profile();
      default: return null;
    }
  }

  createKinds(section: string): EditorKind[] {
    if (section === 'recommandations') return ['advice', 'article'];
    if (section === 'profil') return ['profile'];
    return [];
  }

  actionsFor(key: string, badge: string, id: number): WorkspaceAction[] {
    if (key.startsWith('advice-')) {
      if (badge === 'Brouillon') return [{ label: 'Valider', path: `/conseils/${id}/valider` }];
      if (badge === 'Validé') return [{ label: 'Publier', path: `/conseils/${id}/publier` }];
      if (badge === 'Publié') return [{ label: 'Archiver', path: `/conseils/${id}/archiver` }];
      if (badge === 'Archivé') return [{ label: 'Désarchiver', path: `/conseils/${id}/desarchiver` }];
    }
    if (key.startsWith('article-')) {
      if (badge === 'Brouillon') return [{ label: 'Publier', path: `/articles/${id}/publier` }];
      if (badge === 'Publié') return [{ label: 'Archiver', path: `/articles/${id}/archiver` }];
      if (badge === 'Archivé') return [{ label: 'Désarchiver', path: `/articles/${id}/desarchiver` }];
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

  private paged<T>(path: string, page: number, size: number, toRow: (item: T) => WorkspaceRow,
    extra: Record<string, string> = {}): Observable<WorkspacePageResult> {
    let params = new HttpParams().set('page', page).set('size', size);
    for (const [key, value] of Object.entries(extra)) params = params.set(key, value);
    return this.http.get<ApiPage<T>>(`${API_BASE_URL}${path}`, { params }).pipe(
      map((result) => ({ rows: result.content.map(toRow), total: result.totalElements })),
    );
  }

  private appointments(page: number, size: number, appointmentStatus?: string): Observable<WorkspacePageResult> {
    return this.paged<Appointment>('/professionnel/rendez-vous', page, size, (item) => ({
      key: `appointment-${item.id}`,
      title: item.utilisateurId == null ? `Rendez-vous n° ${item.id}` : `Patient n° ${item.utilisateurId}`,
      subtitle: item.motif || 'Motif non renseigné',
      value: [formatApiDate(item.dateHeure), item.mode ? formatStatusLabel(item.mode) : null].filter(Boolean).join(' · '),
      ...statusBadge(item.statut),
      detail: item.statut === 'DEMANDE' ? {
        kind: 'appointment', showAppointmentComment: true, commentLabel: 'Motif du refus (si nécessaire)',
      } : undefined,
    }), appointmentStatus ? { statut: appointmentStatus } : {});
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
        hint: 'Cette section affiche les questions et échanges avec les patients.' };
    }));
  }

  private myContent(page: number, size: number): Observable<WorkspacePageResult> {
    const params = new HttpParams().set('page', 0).set('size', (page + 1) * size).set('sort', 'titre,asc');
    return forkJoin({
      advice: this.http.get<ApiPage<Advice>>(`${API_BASE_URL}/conseils/mes-conseils`, { params }),
      articles: this.http.get<ApiPage<Article>>(`${API_BASE_URL}/articles/mes-articles`, { params }),
    }).pipe(map(({ advice, articles }) => {
      const rows = [
        ...advice.content.map((item): WorkspaceRow => ({
          key: `advice-${item.id}`, title: item.titre, imageUrl: item.imageUrl, data: { ...item },
          subtitle: ['Conseil', item.categorie].filter(Boolean).join(' · '), value: shortSummary(item.contenu),
          ...(item.statut === 'BROUILLON' && item.validateurId != null
            ? { badge: 'Validé', badgeTone: 'green' as const } : statusBadge(item.statut)),
          detail: item.statut === 'BROUILLON' ? { editKind: 'advice' } : undefined,
        })),
        ...articles.content.map((item): WorkspaceRow => ({
          key: `article-${item.id}`, title: item.titre, imageUrl: item.imageUrl, data: { ...item },
          subtitle: ['Article', item.theme ? formatStatusLabel(item.theme) : null].filter(Boolean).join(' · '),
          value: shortSummary(item.contenu), ...statusBadge(item.statut),
          detail: item.statut === 'BROUILLON' ? { editKind: 'article' } : undefined,
        })),
      ];
      rows.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
      return { rows: rows.slice(page * size, (page + 1) * size), total: advice.totalElements + articles.totalElements,
        hint: 'Conseils et articles rédigés par vous.' };
    }));
  }
}
