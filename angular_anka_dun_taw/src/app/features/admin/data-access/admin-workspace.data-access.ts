import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiPage, FoodPrice, WorkspacePageResult, WorkspaceRow } from '../../../shared/models/workspace-list.models';
import { formatApiDate, formatStatusLabel, shortSummary, statusBadge } from '../../../shared/utils/workspace-formatters';
import { WorkspaceAction } from '../../../shared/models/workspace-list.models';
import { EditorKind } from '../../../shared/forms/workspace-editor.service';

interface Food { id: number; nom: string; description?: string; imageUrl?: string | null; categorieNom?: string; origine?: string; calories?: number; disponible: boolean }
interface Category { id: number; nom: string; description?: string; imageUrl?: string | null; groupeAssiette?: string; active: boolean }
interface Recipe { id: number; nom: string; description?: string; imageUrl?: string | null; dureePreparationMinutes?: number; nombrePersonnes?: number; statut?: string }
interface Journal { id: number; dateHeure?: string; acteurId?: number; action?: string; typeEntite?: string; idEntite?: number; resultat?: string; description?: string }
interface Menu { id: number; titre: string; description?: string; imageUrl?: string | null; type?: string; dateDebut?: string; statut?: string; beneficiaireIds?: number[]; coutTotalEstime?: number; devise?: string }
interface Advice { id: number; titre: string; contenu?: string; imageUrl?: string | null; categorie?: string; statut?: string; validateurId?: number | null }
interface Article { id: number; titre: string; contenu?: string; imageUrl?: string | null; theme?: string; statut?: string }
interface Quiz { id: number; titre: string; description?: string; imageUrl?: string | null; scoreMaximum?: number }
interface AdminQuiz { id: number; statut: string; scoreMaximum: number; contenu: { titre: string; description?: string; imageUrl?: string | null } }
interface Challenge { id: number; titre: string; imageUrl?: string | null; objectif?: string; nombrePoints?: number; dateFin?: string; statut?: string }
interface Badge { id: number; nom: string; imageUrl?: string | null; description?: string; points?: number; conditionObtention?: string }

@Injectable({ providedIn: 'root' })
export class AdminWorkspaceDataAccess {
  private readonly http = inject(HttpClient);

  load(section: string, page: number, size: number, status = ''): Observable<WorkspacePageResult> | null {
    switch (section) {
      case 'aliments': return this.paged<Food>('/aliments', page, size, (item) => ({
        key: `food-${item.id}`, title: item.nom, imageUrl: item.imageUrl,
        subtitle: [item.categorieNom, item.origine ? formatStatusLabel(item.origine) : null].filter(Boolean).join(' · ') || shortSummary(item.description),
        value: item.calories == null ? shortSummary(item.description) : `${item.calories} kcal`,
        badge: item.disponible ? 'Disponible' : 'Indisponible', badgeTone: item.disponible ? 'green' : 'red',
        detail: { kind: 'food', editKind: 'food', showPriceCreate: true, showPriceList: true },
      }));
      case 'categories': return this.paged<Category>('/categories-aliments', page, size, (item) => ({
        key: `category-${item.id}`, title: item.nom, subtitle: shortSummary(item.description), imageUrl: item.imageUrl,
        value: item.groupeAssiette ? formatStatusLabel(item.groupeAssiette) : 'Groupe non renseigné',
        badge: item.active ? 'Active' : 'Inactive', badgeTone: item.active ? 'green' : 'red',
        detail: { editKind: 'category' },
      }));
      case 'recettes': return this.recipes('/admin/recettes', page, size);
      case 'menus': return this.paged<Menu>('/admin/menus', page, size, (item) => ({
        key: `menu-${item.id}`, title: item.titre, data: { ...item }, imageUrl: item.imageUrl,
        subtitle: [item.type ? formatStatusLabel(item.type) : null, item.beneficiaireIds?.length != null ? `${item.beneficiaireIds.length} bénéficiaire(s)` : null].filter(Boolean).join(' · ') || shortSummary(item.description),
        value: [item.dateDebut ? `Du ${formatApiDate(item.dateDebut)}` : null, item.coutTotalEstime == null ? null : `${item.coutTotalEstime} ${item.devise || 'FCFA'}`].filter(Boolean).join(' · ') || shortSummary(item.description),
        ...statusBadge(item.statut),
      }), status ? { statut: status } : {});
      case 'quiz': return this.paged<AdminQuiz>('/admin/quiz', page, size, (item) => ({
        key: `quiz-${item.id}`, title: item.contenu.titre, subtitle: shortSummary(item.contenu.description), data: item.contenu, imageUrl: item.contenu.imageUrl,
        value: `${item.scoreMaximum ?? 0} point(s)`, ...statusBadge(item.statut),
        detail: item.statut === 'BROUILLON' ? { editKind: 'quiz' } : undefined,
      }), status ? { statut: status } : {});
      case 'defis': return this.paged<Challenge>('/admin/defis', page, size, (item) => ({
        key: `challenge-${item.id}`, title: item.titre, subtitle: shortSummary(item.objectif), data: { ...item }, imageUrl: item.imageUrl,
        value: `${item.nombrePoints ?? 0} point(s) · ${formatApiDate(item.dateFin)}`, ...statusBadge(item.statut),
        detail: { kind: 'challenge', editKind: item.statut === 'BROUILLON' ? 'challenge' : undefined, showChallengeProgress: true },
      }), status ? { statut: status } : {});
      case 'badges': return this.http.get<Badge[]>(`${API_BASE_URL}/badges`).pipe(map((items) => ({
        rows: items.slice(page * size, (page + 1) * size).map((item): WorkspaceRow => ({
          key: `badge-${item.id}`, title: item.nom, subtitle: shortSummary(item.description), imageUrl: item.imageUrl,
          value: `${item.points ?? 0} point(s) · ${item.conditionObtention || 'Condition non renseignée'}`,
          badge: 'Actif', badgeTone: 'green',
          detail: { kind: 'badge', showBadgeAssignment: true },
        })), total: items.length,
      })));
      case 'contenus': return this.publishedContent(page, size);
      case 'historique': return this.paged<Journal>('/admin/journal-activite', page, size, (item) => ({
        key: `journal-${item.id}`, title: item.action ? formatStatusLabel(item.action) : 'Activité',
        subtitle: item.description || [item.typeEntite, item.idEntite != null ? `n° ${item.idEntite}` : null].filter(Boolean).join(' ') || 'Détail non renseigné',
        value: `${formatApiDate(item.dateHeure)} · Acteur n° ${item.acteurId ?? '—'}`,
        ...statusBadge(item.resultat),
      }));
      default: return null;
    }
  }

  createKinds(section: string): EditorKind[] {
    const kinds: Record<string, EditorKind> = {
      categories: 'category', aliments: 'food', recettes: 'recipe', quiz: 'quiz', defis: 'challenge', badges: 'badge',
    };
    return kinds[section] ? [kinds[section]] : [];
  }

  actionsFor(key: string, badge: string, id: number): WorkspaceAction[] {
    if (key.startsWith('recipe-')) {
      if (badge === 'Brouillon') return [{ label: 'Publier', path: `/recettes/${id}/publier` }];
      if (badge === 'Publié' || badge === 'Publiée') return [{ label: 'Archiver', path: `/recettes/${id}/archiver` }];
    }
    if (key.startsWith('menu-') && badge === 'Publié') return [{ label: 'Archiver', path: `/admin/menus/${id}/archiver` }];
    if (key.startsWith('food-') && badge === 'Disponible') return [{ label: 'Désactiver', path: `/aliments/${id}`, method: 'DELETE' }];
    if (key.startsWith('category-') && badge === 'Active') return [{ label: 'Désactiver', path: `/categories-aliments/${id}`, method: 'DELETE' }];
    if (key.startsWith('quiz-')) {
      if (badge === 'Brouillon') return [{ label: 'Publier', path: `/admin/quiz/${id}/publier` }];
      if (badge === 'Publié') return [{ label: 'Archiver', path: `/admin/quiz/${id}/archiver` }];
    }
    if (key.startsWith('challenge-')) {
      if (badge === 'Brouillon') return [{ label: 'Publier', path: `/admin/defis/${id}/publier` }];
      if (badge === 'Publié') return [{ label: 'Archiver', path: `/admin/defis/${id}/archiver` }];
    }
    return [];
  }

  foodPrices(foodId: number): Observable<FoodPrice[]> {
    return this.http.get<FoodPrice[]>(`${API_BASE_URL}/aliments/${foodId}/prix`);
  }

  advanceChallenge(challengeId: number, userId: number, progress: number): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}/admin/defis/${challengeId}/progressions`, {
      utilisateurId: userId, progressionAjoutee: progress,
    });
  }

  private paged<T>(path: string, page: number, size: number, toRow: (item: T) => WorkspaceRow,
    extra: Record<string, string> = {}): Observable<WorkspacePageResult> {
    let params = new HttpParams().set('page', page).set('size', size);
    for (const [key, value] of Object.entries(extra)) params = params.set(key, value);
    return this.http.get<ApiPage<T>>(`${API_BASE_URL}${path}`, { params }).pipe(
      map((result) => ({ rows: result.content.map(toRow), total: result.totalElements })),
    );
  }

  private recipes(path: string, page: number, size: number): Observable<WorkspacePageResult> {
    return this.paged<Recipe>(path, page, size, (item) => ({
      key: `recipe-${item.id}`, title: item.nom, subtitle: shortSummary(item.description), imageUrl: item.imageUrl,
      value: [item.dureePreparationMinutes == null ? null : `${item.dureePreparationMinutes} min`, item.nombrePersonnes == null ? null : `${item.nombrePersonnes} personne(s)`].filter(Boolean).join(' · ') || 'Préparation non renseignée',
      ...statusBadge(item.statut),
      detail: item.statut === 'BROUILLON' ? { editKind: 'recipe' } : undefined,
    }));
  }

  private publishedContent(page: number, size: number): Observable<WorkspacePageResult> {
    const params = new HttpParams().set('page', 0).set('size', (page + 1) * size).set('sort', 'titre,asc');
    return forkJoin({
      advice: this.http.get<ApiPage<Advice>>(`${API_BASE_URL}/conseils`, { params }),
      articles: this.http.get<ApiPage<Article>>(`${API_BASE_URL}/articles`, { params }),
      quizzes: this.http.get<ApiPage<Quiz>>(`${API_BASE_URL}/quiz`, { params }),
    }).pipe(map(({ advice, articles, quizzes }) => {
      const rows: WorkspaceRow[] = [
        ...advice.content.map((item) => this.adviceRow(item)),
        ...articles.content.map((item) => this.articleRow(item)),
        ...quizzes.content.map((item): WorkspaceRow => ({
          key: `quiz-${item.id}`, title: item.titre, imageUrl: item.imageUrl,
          subtitle: `Quiz · ${item.scoreMaximum ?? 0} point(s)`, value: shortSummary(item.description),
          badge: 'Publié', badgeTone: 'green',
        })),
      ];
      return this.mergeContent(rows, advice.totalElements + articles.totalElements + quizzes.totalElements, page, size,
        'Cette liste regroupe les conseils, articles et quiz publiés.');
    }));
  }

  private mergeContent(rows: WorkspaceRow[], total: number, page: number, size: number, hint: string): WorkspacePageResult {
    rows.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    return { rows: rows.slice(page * size, (page + 1) * size), total, hint };
  }

  private adviceRow(item: Advice): WorkspaceRow {
    return { key: `advice-${item.id}`, title: item.titre, imageUrl: item.imageUrl, data: { ...item },
      subtitle: ['Conseil', item.categorie].filter(Boolean).join(' · '), value: shortSummary(item.contenu),
      ...(item.statut === 'BROUILLON' && item.validateurId != null
        ? { badge: 'Validé', badgeTone: 'green' as const } : statusBadge(item.statut)) };
  }

  private articleRow(item: Article): WorkspaceRow {
    return { key: `article-${item.id}`, title: item.titre, imageUrl: item.imageUrl, data: { ...item },
      subtitle: ['Article', item.theme ? formatStatusLabel(item.theme) : null].filter(Boolean).join(' · '),
      value: shortSummary(item.contenu), ...statusBadge(item.statut) };
  }
}
