import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, Observable, reduce } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface ProfessionalAppointment {
  id: number; utilisateurId: number; utilisateurPrenom?: string | null; utilisateurNom?: string | null;
  dateHeure: string; motif: string | null; mode?: string | null;
  statut: 'DEMANDE' | 'ACCEPTE' | 'REFUSE' | 'ANNULE' | 'TERMINE';
  commentaire?: string | null; dateReponse?: string | null;
}
export interface BeneficiaryName { id: number; prenom: string; nom: string }
interface ApiPage<T> { content: T[]; number: number; totalPages: number }

@Injectable({ providedIn: 'root' })
export class NutritionistAppointmentsDataAccess {
  private readonly http = inject(HttpClient);

  appointments(): Observable<ProfessionalAppointment[]> {
    const getPage = (number: number) => this.http.get<ApiPage<ProfessionalAppointment>>(`${API_BASE_URL}/professionnel/rendez-vous`, {
      params: new HttpParams().set('page', number).set('size', 100).set('sort', 'dateHeure,desc'),
    });
    return getPage(0).pipe(
      expand((page) => page.number + 1 < page.totalPages ? getPage(page.number + 1) : EMPTY),
      reduce((all, page) => all.concat(page.content), [] as ProfessionalAppointment[]),
    );
  }

  beneficiaries(): Observable<BeneficiaryName[]> {
    const getPage = (number: number) => this.http.get<ApiPage<BeneficiaryName>>(`${API_BASE_URL}/professionnel/beneficiaires`, {
      params: new HttpParams().set('page', number).set('size', 100),
    });
    return getPage(0).pipe(
      expand((page) => page.number + 1 < page.totalPages ? getPage(page.number + 1) : EMPTY),
      reduce((all, page) => all.concat(page.content), [] as BeneficiaryName[]),
    );
  }

  accept(id: number): Observable<ProfessionalAppointment> {
    return this.http.post<ProfessionalAppointment>(`${API_BASE_URL}/professionnel/rendez-vous/${id}/accepter`, {});
  }
  refuse(id: number, commentaire: string): Observable<ProfessionalAppointment> {
    return this.http.post<ProfessionalAppointment>(`${API_BASE_URL}/professionnel/rendez-vous/${id}/refuser`, { commentaire });
  }
  finish(id: number): Observable<ProfessionalAppointment> {
    return this.http.post<ProfessionalAppointment>(`${API_BASE_URL}/professionnel/rendez-vous/${id}/terminer`, {});
  }
}
