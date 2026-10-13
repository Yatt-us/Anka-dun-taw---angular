import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, Observable, reduce } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface ProfessionalConversation {
  id: number;
  interlocuteurId: number;
  interlocuteurNom: string | null;
  interlocuteurPrenom: string | null;
  dernierMessage: string | null;
  dernierMessageA: string | null;
  messagesNonLus: number;
}

export interface NutritionistAppointment {
  id: number;
  utilisateurId: number;
  dateHeure: string;
  motif: string;
  statut: 'DEMANDE' | 'ACCEPTE' | 'REFUSE' | 'ANNULE' | 'TERMINE';
}

export interface BeneficiarySummary { id: number; nom: string; prenom: string }

interface Page<T> {
  content: T[];
  number: number;
  totalPages: number;
  totalElements: number;
}

@Injectable({ providedIn: 'root' })
export class NutritionistDashboardApi {
  private readonly http = inject(HttpClient);

  conversations(): Observable<ProfessionalConversation[]> {
    return this.http.get<ProfessionalConversation[]>(
      `${API_BASE_URL}/professionnel/messagerie/conversations`,
    );
  }

  requestedAppointments(): Observable<Page<NutritionistAppointment>> {
    const params = new HttpParams().set('statut', 'DEMANDE').set('size', '1');
    return this.http.get<Page<NutritionistAppointment>>(
      `${API_BASE_URL}/professionnel/rendez-vous`,
      { params },
    );
  }

  acceptedAppointments(): Observable<NutritionistAppointment[]> {
    const url = `${API_BASE_URL}/professionnel/rendez-vous`;
    const params = new HttpParams()
      .set('statut', 'ACCEPTE')
      .set('size', '100')
      .set('sort', 'dateHeure,asc');
    const page = (number: number) =>
      this.http.get<Page<NutritionistAppointment>>(url, {
        params: params.set('page', String(number)),
      });
    return page(0).pipe(
      expand((result) => (result.number + 1 < result.totalPages ? page(result.number + 1) : EMPTY)),
      reduce((all, result) => all.concat(result.content), [] as NutritionistAppointment[]),
    );
  }

  articleCount(): Observable<Page<unknown>> {
    return this.http.get<Page<unknown>>(`${API_BASE_URL}/articles/mes-articles`, {
      params: new HttpParams().set('size', '1'),
    });
  }

  adviceCount(): Observable<Page<unknown>> {
    return this.http.get<Page<unknown>>(`${API_BASE_URL}/conseils/mes-conseils`, {
      params: new HttpParams().set('size', '1'),
    });
  }

  beneficiaries(): Observable<Page<BeneficiarySummary>> {
    return this.http.get<Page<BeneficiarySummary>>(`${API_BASE_URL}/professionnel/beneficiaires`, {
      params: new HttpParams().set('size', '100'),
    });
  }
}
