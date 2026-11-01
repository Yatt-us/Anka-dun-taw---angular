import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WorkspaceEditorService } from './workspace-editor.service';

describe('WorkspaceEditorService', () => {
  let service: WorkspaceEditorService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WorkspaceEditorService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ne transmet pas le statut de disponibilité en modifiant un aliment', () => {
    service.save('food', {
      nom: 'Carotte', categorieId: 4, disponible: 'on', id: 7, categorieNom: 'Légumes',
    }, 7).subscribe();

    const request = http.expectOne('/api/v1/aliments/7');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ nom: 'Carotte', categorieId: 4 });
    request.flush({ id: 7 });
  });

  it('modifie un prix existant au lieu de créer un doublon', () => {
    const payload = { zone: 'BAMAKO', prix: 325, quantiteReference: 1, unite: 'kg', dateDebut: '2026-10-01', devise: 'XOF' };
    service.save('price', payload, 8, 1).subscribe();

    const request = http.expectOne('/api/v1/aliments/1/prix/8');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush({ id: 8 });
  });

  it('ajoute un prix si la région ne possède pas encore de relevé', () => {
    const payload = { zone: 'KAYES', prix: 320, quantiteReference: 1, unite: 'kg', dateDebut: '2026-10-01', devise: 'XOF' };
    service.save('price', payload, undefined, 1).subscribe();

    const request = http.expectOne('/api/v1/aliments/1/prix');
    expect(request.request.method).toBe('POST');
    request.flush({ id: 9 });
  });
});
