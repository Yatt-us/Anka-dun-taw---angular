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

export interface AdminPeopleFilters {
  recherche?: string;
  role?: string;
  statut?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminPeopleDataAccess {
  private readonly http = inject(HttpClient);

  accounts(page: number, size: number, filters: AdminPeopleFilters): Observable<AdminPeoplePage> {
    return this.http.get<AdminPeoplePage>(`${API_BASE_URL}/admin/comptes`, {
      params: this.params(page, size, filters),
    });
  }

  exportAccounts(filters: AdminPeopleFilters): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}/admin/comptes/export`, {
      params: this.params(0, 5, filters).delete('page').delete('size'),
      responseType: 'blob',
    });
  }

  professionals(page: number, size: number, statut?: string): Observable<AdminPeoplePage> {
    const params = this.params(page, size, { statut });
    return this.http.get<AdminPeoplePage>(`${API_BASE_URL}/admin/professionnels`, { params });
  }

  professional(id: number): Observable<AdminPerson> {
    return this.http.get<AdminPerson>(`${API_BASE_URL}/admin/professionnels/${id}`);
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

  private params(page: number, size: number, filters: AdminPeopleFilters = {}): HttpParams {
    let params = new HttpParams().set('page', page).set('size', size);
    for (const [key, value] of Object.entries(filters)) {
      if (value) params = params.set(key, value);
    }
    return params;
  }
}
