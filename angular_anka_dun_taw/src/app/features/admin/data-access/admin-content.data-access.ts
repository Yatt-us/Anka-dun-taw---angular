import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export type ContentStatus = 'BROUILLON' | 'PUBLIE' | 'ARCHIVE';
export interface ContentPage<T> { content: T[]; totalElements: number; number: number; totalPages: number }
export interface AdminQuiz {
  id: number;
  statut: ContentStatus;
  scoreMaximum: number;
  contenu: { titre: string; description?: string | null; dateQuestionDuJour?: string | null; questions?: unknown[] };
}
export interface AdminChallenge {
  id: number; titre: string; description?: string | null; objectif?: string | null;
  dateDebut?: string | null; dateFin?: string | null; nombrePoints: number; statut: ContentStatus;
}
export interface AdminAdvice {
  id: number; titre: string; contenu?: string | null; categorie?: string | null;
  statut: string; datePublication?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminContentDataAccess {
  private readonly http = inject(HttpClient);
  quizzes(page = 0, size = 100, status?: ContentStatus): Observable<ContentPage<AdminQuiz>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('statut', status);
    return this.http.get<ContentPage<AdminQuiz>>(`${API_BASE_URL}/admin/quiz`, { params });
  }
  challenges(page = 0, size = 100, status?: ContentStatus): Observable<ContentPage<AdminChallenge>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('statut', status);
    return this.http.get<ContentPage<AdminChallenge>>(`${API_BASE_URL}/admin/defis`, { params });
  }
  advice(page = 0, size = 100): Observable<ContentPage<AdminAdvice>> {
    return this.http.get<ContentPage<AdminAdvice>>(`${API_BASE_URL}/conseils`, { params: new HttpParams().set('page', page).set('size', size) });
  }
  publishQuiz(id: number): Observable<unknown> { return this.http.post(`${API_BASE_URL}/admin/quiz/${id}/publier`, {}); }
  archiveQuiz(id: number): Observable<unknown> { return this.http.post(`${API_BASE_URL}/admin/quiz/${id}/archiver`, {}); }
  deleteDraftQuiz(id: number): Observable<void> { return this.http.delete<void>(`${API_BASE_URL}/admin/quiz/${id}`); }
  publishChallenge(id: number): Observable<unknown> { return this.http.post(`${API_BASE_URL}/admin/defis/${id}/publier`, {}); }
  archiveChallenge(id: number): Observable<unknown> { return this.http.post(`${API_BASE_URL}/admin/defis/${id}/archiver`, {}); }
}
