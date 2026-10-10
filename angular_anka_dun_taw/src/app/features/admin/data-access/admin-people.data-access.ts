import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface AdminPerson {
  id: number;
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  photoProfilUrl?: string | null;
  role?: string;
  statut?: string;
  statutCompte?: string;
  specialite?: string;
  qualification?: string;
  numeroOrdre?: string;
  anneesExperience?: number;
  biographie?: string;
  statutVerification?: string;
  dateInscription?: string;
  dateVerification?: string;
  verifieParId?: number | null;
}

export interface AdminPeoplePage {
  content: AdminPerson[];
  totalElements: number;
}

@Injectable({ providedIn: 'root' })
export class AdminPeopleDataAccess {
  private readonly http = inject(HttpClient);

  users(page: number, size: number): Observable<AdminPeoplePage> {
    return this.page('/admin/utilisateurs', page, size);
  }

  professionals(page: number, size: number): Observable<AdminPeoplePage> {
    const params = this.params(page, size);
    return this.http.get<AdminPeoplePage>(`${API_BASE_URL}/admin/professionnels`, { params });
  }

  verify(id: number): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}/admin/professionnels/${id}/verifier`, {});
  }

  refuse(id: number, commentaire: string): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}/admin/professionnels/${id}/refuser`, { commentaire });
  }

  changeRole(id: number, role: string): Observable<unknown> {
    return this.http.put(`${API_BASE_URL}/admin/utilisateurs/${id}/role`, { role });
  }

  deactivateUser(id: number): Observable<unknown> {
    return this.http.post(`${API_BASE_URL}/admin/utilisateurs/${id}/desactiver`, {});
  }

  private page(path: string, page: number, size: number): Observable<AdminPeoplePage> {
    return this.http.get<AdminPeoplePage>(`${API_BASE_URL}${path}`, {
      params: this.params(page, size),
    });
  }

  private params(page: number, size: number, filters: Record<string, string> = {}): HttpParams {
    let params = new HttpParams().set('page', page).set('size', size);
    for (const [key, value] of Object.entries(filters)) params = params.set(key, value);
    return params;
  }
}
