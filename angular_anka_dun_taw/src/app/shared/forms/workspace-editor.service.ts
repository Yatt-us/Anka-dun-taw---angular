import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';

export type EditorKind = 'category' | 'food' | 'price' | 'recipe' | 'menu' | 'advice' | 'article' | 'profile' | 'badge' | 'challenge' | 'quiz';
export interface Choice { id: number; nom: string }
interface ApiPage<T> { content: T[] }

@Injectable({ providedIn: 'root' })
export class WorkspaceEditorService {
  private readonly http = inject(HttpClient);

  choices(path: 'aliments' | 'categories-aliments' | 'recettes'): Observable<ApiPage<Choice>> {
    return this.http.get<ApiPage<Choice>>(`${API_BASE_URL}/${path}`, {
      params: new HttpParams().set('page', 0).set('size', 200),
    });
  }

  load(kind: EditorKind, id?: number): Observable<Record<string, unknown>> {
    const path = kind === 'profile' ? '/professionnels/me' : kind === 'recipe' ? `/admin/recettes/${id}` : `${this.path(kind)}/${id}`;
    return this.http.get<Record<string, unknown>>(`${API_BASE_URL}${path}`);
  }

  save(kind: EditorKind, payload: object, id?: number, relatedId?: number): Observable<unknown> {
    if (kind === 'profile') return this.http.put(`${API_BASE_URL}/professionnels/me`, payload);
    if (kind === 'price') return this.http.post(`${API_BASE_URL}/aliments/${relatedId}/prix`, payload);
    const path = `${API_BASE_URL}${this.path(kind)}`;
    // La disponibilité est pilotée uniquement par Désactiver/Réactiver ; ne jamais la réécrire avec le formulaire.
    const body = kind === 'food'
      ? Object.fromEntries(Object.entries(payload).filter(([key]) => !['disponible', 'id', 'categorieNom'].includes(key)))
      : payload;
    return id ? this.http.put(`${path}/${id}`, body) : this.http.post(path, body);
  }

  uploadFoodImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${API_BASE_URL}/aliments/images`, formData);
  }

  action(path: string, payload: object = {}): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}${path}`, payload);
  }
  mutate(method: 'PUT' | 'DELETE', path: string, payload?: object): Observable<unknown> {
    return this.http.request(method, `${API_BASE_URL}${path}`, { body: payload });
  }

  private path(kind: EditorKind): string {
    const paths: Record<Exclude<EditorKind, 'profile' | 'price'>, string> = {
      category: '/categories-aliments', food: '/aliments', recipe: '/recettes',
      menu: '/professionnel/menus', advice: '/conseils', article: '/articles',
      badge: '/admin/badges', challenge: '/admin/defis', quiz: '/admin/quiz',
    };
    if (kind === 'profile' || kind === 'price') throw new Error('Formulaire sans chemin direct.');
    return paths[kind];
  }
}
