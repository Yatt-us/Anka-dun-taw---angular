import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiPage, ProfessionalMessage } from '../../../shared/models/workspace-list.models';

@Injectable({ providedIn: 'root' })
export class ProfessionalMessagingDataAccess {
  private readonly http = inject(HttpClient);

  messages(conversationId: number, page: number, size: number): Observable<ApiPage<ProfessionalMessage>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiPage<ProfessionalMessage>>(
      `${API_BASE_URL}/professionnel/messagerie/conversations/${conversationId}/messages`, { params },
    );
  }

  reply(conversationId: number, content: string): Observable<unknown> {
    return this.http.post(
      `${API_BASE_URL}/professionnel/messagerie/conversations/${conversationId}/messages`,
      { contenu: content },
    );
  }
}
