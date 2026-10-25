import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';

export interface ZoneOption { code: string; libelle: string }

/** Codes de l'API : 19 régions et le district de Bamako. */
export const MALI_ZONES: readonly ZoneOption[] = [
  { code: 'KAYES', libelle: 'Kayes' },
  { code: 'KOULIKORO', libelle: 'Koulikoro' },
  { code: 'SIKASSO', libelle: 'Sikasso' },
  { code: 'SEGOU', libelle: 'Ségou' },
  { code: 'MOPTI', libelle: 'Mopti' },
  { code: 'TOMBOUCTOU', libelle: 'Tombouctou' },
  { code: 'GAO', libelle: 'Gao' },
  { code: 'KIDAL', libelle: 'Kidal' },
  { code: 'TAOUDENIT', libelle: 'Taoudénit' },
  { code: 'MENAKA', libelle: 'Ménaka' },
  { code: 'NIORO', libelle: 'Nioro' },
  { code: 'KITA', libelle: 'Kita' },
  { code: 'DIOILA', libelle: 'Dioïla' },
  { code: 'NARA', libelle: 'Nara' },
  { code: 'BOUGOUNI', libelle: 'Bougouni' },
  { code: 'KOUTIALA', libelle: 'Koutiala' },
  { code: 'SAN', libelle: 'San' },
  { code: 'DOUENTZA', libelle: 'Douentza' },
  { code: 'BANDIAGARA', libelle: 'Bandiagara' },
  { code: 'BAMAKO', libelle: 'District de Bamako' },
];

export function zoneLabel(code: string): string {
  return MALI_ZONES.find((zone) => zone.code === code)?.libelle ?? code;
}

export function normalizeZones(received: ZoneOption[]): ZoneOption[] {
  const labels = new Map(received.map((zone) => [zone.code, zone.libelle]));
  return MALI_ZONES.map((zone) => ({ ...zone, libelle: labels.get(zone.code)?.trim() || zone.libelle }));
}

@Injectable({ providedIn: 'root' })
export class ZonesDataAccess {
  private readonly http = inject(HttpClient);

  list(): Observable<ZoneOption[]> {
    return this.http.get<ZoneOption[]>(`${API_BASE_URL}/zones`).pipe(
      map((zones) => normalizeZones(Array.isArray(zones) ? zones : [])),
      catchError(() => of(normalizeZones([]))),
    );
  }
}
