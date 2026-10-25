import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface AdminRecipe {
  id: number;
  nom: string;
  description?: string | null;
  instructions?: string | null;
  dureePreparationMinutes?: number | null;
  nombrePersonnes?: number | null;
  imageUrl?: string | null;
  difficulte?: 'FACILE' | 'MOYEN' | 'DIFFICILE' | null;
  statut: 'BROUILLON' | 'PUBLIEE' | 'ARCHIVEE';
  ingredients?: { alimentId: number; alimentNom?: string; quantite?: number; unite?: string }[];
}

export interface AdminRecipePage { content: AdminRecipe[]; totalElements: number }
export interface AdminRecipeCost { coutEstime: number; zone: string; devise: string }

@Injectable({ providedIn: 'root' })
export class AdminRecipesDataAccess {
  private readonly http = inject(HttpClient);

  recipes(page: number, size: number, query = '', status: AdminRecipe['statut'] = 'PUBLIEE'): Observable<AdminRecipePage> {
    let params = new HttpParams().set('page', page).set('size', size).set('statut', status);
    if (query) params = params.set('q', query);
    return this.http.get<AdminRecipePage>(`${API_BASE_URL}/admin/recettes`, { params });
  }

  detail(id: number): Observable<AdminRecipe> {
    return this.http.get<AdminRecipe>(`${API_BASE_URL}/admin/recettes/${id}`);
  }

  cost(id: number): Observable<AdminRecipeCost | null> {
    return this.http.get<AdminRecipeCost | null>(`${API_BASE_URL}/recettes/${id}/cout-estime`, {
      params: new HttpParams().set('zone', 'BAMAKO'),
    });
  }

  archive(id: number): Observable<AdminRecipe> {
    return this.http.post<AdminRecipe>(`${API_BASE_URL}/recettes/${id}/archiver`, {});
  }

  restore(id: number): Observable<AdminRecipe> {
    return this.http.post<AdminRecipe>(`${API_BASE_URL}/recettes/${id}/desarchiver`, {});
  }

  publish(id: number): Observable<AdminRecipe> {
    return this.http.post<AdminRecipe>(`${API_BASE_URL}/recettes/${id}/publier`, {});
  }
}
