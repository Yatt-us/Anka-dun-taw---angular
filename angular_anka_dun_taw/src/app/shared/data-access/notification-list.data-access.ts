import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api.config';
import { ApiPage, WorkspacePageResult, WorkspaceRow } from '../models/workspace-list.models';
import { formatApiDate, shortSummary } from '../utils/workspace-formatters';

interface Notification { id: number; titre?: string; message?: string; dateReception?: string; lue: boolean }

@Injectable({ providedIn: 'root' })
export class NotificationListDataAccess {
  private readonly http = inject(HttpClient);

  load(page: number, size: number): Observable<WorkspacePageResult> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiPage<Notification>>(`${API_BASE_URL}/me/notifications`, { params }).pipe(
      map((result) => ({
        rows: result.content.map((item): WorkspaceRow => ({
          key: `notification-${item.id}`, title: item.titre || 'Notification',
          subtitle: shortSummary(item.message), value: formatApiDate(item.dateReception),
          badge: item.lue ? 'Lue' : 'À lire', badgeTone: item.lue ? 'neutral' : 'orange',
        })),
        total: result.totalElements,
      })),
    );
  }
}
