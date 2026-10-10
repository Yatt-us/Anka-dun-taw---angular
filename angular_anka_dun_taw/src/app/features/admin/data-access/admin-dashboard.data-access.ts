import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

export interface AdminStatistics {
  utilisateursActifs: number;
  dieteticiensActifs: number;
  nutritionnistesActifs: number;
  professionnelsEnAttente: number;
  menusPublies: number;
  recettesPubliees: number;
  alimentsLocauxDisponibles: number;
  rendezVousDemandes: number;
}

export interface DailyRegistration {
  jour: string;
  nombre: number;
}

export interface ActivityReport {
  debut: string;
  fin: string;
  inscriptionsParJour: DailyRegistration[];
}

export interface JournalActivity {
  id: number;
  dateHeure: string;
  acteurId: number | null;
  action: string;
  typeEntite: string | null;
  description: string | null;
}

interface Page<T> {
  content: T[];
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardApi {
  private readonly http = inject(HttpClient);

  statistics(): Observable<AdminStatistics> {
    return this.http.get<AdminStatistics>(`${API_BASE_URL}/admin/statistiques`);
  }

  report(start: string, end: string): Observable<ActivityReport> {
    const params = new HttpParams().set('debut', start).set('fin', end);
    return this.http.get<ActivityReport>(`${API_BASE_URL}/admin/rapports/activite`, { params });
  }

  recentActivity(): Observable<Page<JournalActivity>> {
    const params = new HttpParams().set('size', '5').set('sort', 'dateHeure,desc');
    return this.http.get<Page<JournalActivity>>(`${API_BASE_URL}/admin/journal-activite`, {
      params,
    });
  }
}
