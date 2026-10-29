import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BeneficiarySummary, NutritionistDashboardApi } from './nutritionniste-dashboard.data-access';

describe('NutritionistDashboardApi', () => {
  it('rassemble toutes les pages de bénéficiaires pour les noms des rendez-vous', () => {
    TestBed.configureTestingModule({ providers: [
      NutritionistDashboardApi,
      provideHttpClient(),
      provideHttpClientTesting(),
    ] });
    const api = TestBed.inject(NutritionistDashboardApi);
    const http = TestBed.inject(HttpTestingController);
    let beneficiaries: BeneficiarySummary[] | undefined;
    api.beneficiaries().subscribe((result) => { beneficiaries = result; });

    const first = http.expectOne((request) =>
      request.url.endsWith('/professionnel/beneficiaires') && request.params.get('page') === '0');
    expect(first.request.params.get('size')).toBe('100');
    first.flush({ number: 0, totalPages: 2, totalElements: 101, content: [
      { id: 1, prenom: 'Aïcha', nom: 'Diallo' },
    ] });

    const second = http.expectOne((request) =>
      request.url.endsWith('/professionnel/beneficiaires') && request.params.get('page') === '1');
    second.flush({ number: 1, totalPages: 2, totalElements: 101, content: [
      { id: 101, prenom: 'Fatima', nom: 'Zara' },
    ] });

    expect(beneficiaries?.map((person) => person.id)).toEqual([1, 101]);
    http.verify();
  });
});
