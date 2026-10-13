import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { FoodPrice } from '../../../shared/models/workspace-list.models';

export interface AdminFood {
  id: number;
  nom: string;
  description?: string | null;
  imageUrl?: string | null;
  categorieId?: number | null;
  categorieNom?: string | null;
  calories?: number | null;
  proteines?: number | null;
  lipides?: number | null;
  glucides?: number | null;
  moisDebutSaison?: number | null;
  moisFinSaison?: number | null;
  disponible: boolean;
}

export interface AdminFoodCategory {
  id: number;
  nom: string;
  description?: string | null;
  imageUrl?: string | null;
  active?: boolean;
  groupeAssiette?: string | null;
}

export interface AdminFoodPage<T> {
  content: T[];
  totalElements: number;
}

@Injectable({ providedIn: 'root' })
export class AdminFoodsDataAccess {
  private readonly http = inject(HttpClient);

  foods(page: number, size: number, query = '', categoryId: number | null = null): Observable<AdminFoodPage<AdminFood>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (query) params = params.set('q', query);
    if (categoryId !== null) params = params.set('categorieId', categoryId);
    return this.http.get<AdminFoodPage<AdminFood>>(`${API_BASE_URL}/aliments`, { params });
  }

  categories(page = 0, size = 200, query = ''): Observable<AdminFoodPage<AdminFoodCategory>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (query) params = params.set('q', query);
    return this.http.get<AdminFoodPage<AdminFoodCategory>>(`${API_BASE_URL}/categories-aliments`, {
      params,
    });
  }

  deactivateCategory(categoryId: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/categories-aliments/${categoryId}`);
  }

  prices(foodId: number): Observable<FoodPrice[]> {
    return this.http.get<FoodPrice[]>(`${API_BASE_URL}/aliments/${foodId}/prix`);
  }

  deactivate(foodId: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/aliments/${foodId}`);
  }
}
