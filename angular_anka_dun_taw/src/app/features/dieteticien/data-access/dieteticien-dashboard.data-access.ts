import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, from, mergeMap, Observable, reduce } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface DietitianMenu {
  id: number;
  titre: string;
  statut: 'BROUILLON' | 'EN_VALIDATION' | 'VALIDE' | 'PUBLIE' | 'ARCHIVE';
  beneficiaireIds: number[] | null;
}

export interface AdaptationRequest {
  id: number;
  menuId: number;
  demandeurId: number;
  motif: string;
  statut: 'EN_ATTENTE' | 'EN_COURS' | 'TRAITEE' | 'REFUSEE';
}

export interface ProfessionalAppointment {
  id: number;
  utilisateurId: number;
  dateHeure: string;
  motif: string;
  statut: 'DEMANDE' | 'ACCEPTE' | 'REFUSE' | 'ANNULE' | 'TERMINE';
}

interface Page<T> {
  content: T[];
  number: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class DietitianDashboardApi {
  private readonly http = inject(HttpClient);

  menus(): Observable<DietitianMenu[]> {
    return this.allPages<DietitianMenu>(
      `${API_BASE_URL}/professionnel/menus`,
      new HttpParams().set('size', '100').set('sort', 'dateDebut,desc'),
    );
  }

  adaptations(menus: DietitianMenu[]): Observable<AdaptationRequest[]> {
    return from(menus).pipe(
      mergeMap(
        (menu) =>
          this.allPages<AdaptationRequest>(
            `${API_BASE_URL}/professionnel/menus/${menu.id}/demandes-adaptation`,
            new HttpParams().set('size', '100').set('sort', 'createdAt,desc'),
          ),
        4,
      ),
      reduce((all, requests) => all.concat(requests), [] as AdaptationRequest[]),
    );
  }

  appointments(): Observable<ProfessionalAppointment[]> {
    return this.allPages<ProfessionalAppointment>(
      `${API_BASE_URL}/professionnel/rendez-vous`,
      new HttpParams().set('size', '100').set('sort', 'dateHeure,asc'),
    );
  }

  private allPages<T>(url: string, params: HttpParams): Observable<T[]> {
    const page = (number: number) =>
      this.http.get<Page<T>>(url, { params: params.set('page', String(number)) });
    return page(0).pipe(
      expand((result) => (result.number + 1 < result.totalPages ? page(result.number + 1) : EMPTY)),
      reduce((all, result) => all.concat(result.content), [] as T[]),
    );
  }
}
