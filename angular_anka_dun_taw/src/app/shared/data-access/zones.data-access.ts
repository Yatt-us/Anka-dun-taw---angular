import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';

export interface ZoneOption { code: string; libelle: string }

@Injectable({ providedIn: 'root' })
export class ZonesDataAccess {
  private readonly http = inject(HttpClient);

  list(): Observable<ZoneOption[]> {
    return this.http.get<ZoneOption[]>(`${API_BASE_URL}/zones`);
  }
}
