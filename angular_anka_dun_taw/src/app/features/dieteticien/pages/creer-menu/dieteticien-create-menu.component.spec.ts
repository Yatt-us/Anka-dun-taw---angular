import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DieteticienMenuDataAccess } from '../../data-access/dieteticien-menu.data-access';
import { DieteticienCreateMenuComponent } from './dieteticien-create-menu.component';

function screen(): DieteticienCreateMenuComponent {
  TestBed.configureTestingModule({
    providers: [{ provide: DieteticienMenuDataAccess, useValue: {} }],
  });
  return TestBed.runInInjectionContext(() => new DieteticienCreateMenuComponent());
}

describe('Budget du menu du diététicien', () => {
  it('recalcule le total après la sélection de la première recette', () => {
    const component = screen();
    expect(component.totalCost()).toBeNull();

    component.meals[0].recetteId = 4;
    component.costs.set({ 1: 38 });

    expect(component.totalCost()).toBe(38);
  });

  it('distingue un calcul en cours d’un prix réellement indisponible', () => {
    const component = screen();
    component.selectedPatientId = 3;
    component.profile.set({ nom: 'Profil actif', zone: 'TOMBOUCTOU', objectifId: null,
      budgetActifId: 7, modeBudget: 'AVEC_BUDGET' });
    component.budgets.set([{ id: 7, montant: 10000, devise: 'XOF', periode: 'SEMAINE', actif: true }]);
    component.meals[0].recetteId = 4;
    component.costsLoading.set(true);

    expect(component.budgetMessage()).toContain('en cours');
    component.costsLoading.set(false);
    expect(component.budgetMessage()).toContain('inconnu');
  });

  it('compare les repas par semaine du budget actif, et non au total global du menu', () => {
    const component = screen();
    component.selectedPatientId = 3;
    component.dateDebut = '2026-11-02';
    component.profile.set({ nom: 'Profil actif', zone: 'BAMAKO', objectifId: null,
      budgetActifId: 7, modeBudget: 'AVEC_BUDGET' });
    component.budgets.set([{ id: 7, montant: 1000, devise: 'XOF', periode: 'SEMAINE', actif: true }]);
    component.meals = [
      { key: 1, recetteId: 4, jour: 1, typeRepas: 'DEJEUNER', nombrePortions: 1 },
      { key: 2, recetteId: 5, jour: 8, typeRepas: 'DINER', nombrePortions: 1 },
    ];
    component.costs.set({ 1: 600, 2: 500 });

    expect(component.budgetLines()).toEqual([
      { date: '2026-11-02', cost: 600, limit: 1000 },
      { date: '2026-11-09', cost: 500, limit: 1000 },
    ]);
    expect(component.overBudget()).toBe(false);
    component.meals[1].jour = 2;
    expect(component.budgetLines()).toEqual([{ date: '2026-11-02', cost: 1100, limit: 1000 }]);
    expect(component.overBudget()).toBe(true);
  });

  it('utilise les montants journaliers du profil petit budget et bloque un dépassement', () => {
    const component = screen();
    component.selectedPatientId = 3;
    component.dateDebut = '2026-11-02';
    component.profile.set({ nom: 'Petit budget', zone: 'SEGOU', objectifId: null,
      budgetActifId: null, modeBudget: 'PETIT_BUDGET', plafondPetitBudget: 5000 });
    component.meals = [{ key: 1, recetteId: 4, jour: 1, typeRepas: 'DEJEUNER', nombrePortions: 1 }];
    component.dailyBudgets.set({ '2026-11-02': 800 });
    component.costs.set({ 1: 900 });

    expect(component.budgetLines()).toEqual([{ date: '2026-11-02', cost: 900, limit: 800 }]);
    expect(component.overBudget()).toBe(true);
    component.dailyBudgets.set({ '2026-11-02': 6000 });
    component.costs.set({ 1: 5500 });
    expect(component.budgetLines()[0].limit).toBe(5000);
    expect(component.overBudget()).toBe(true);
  });

  it('signale les prix inconnus et les dates non couvertes par le budget actif', () => {
    const component = screen();
    component.selectedPatientId = 3;
    component.dateDebut = '2026-11-02';
    component.profile.set({ nom: 'Profil actif', zone: 'BAMAKO', objectifId: null,
      budgetActifId: 7, modeBudget: 'AVEC_BUDGET' });
    component.budgets.set([{ id: 7, montant: 1000, devise: 'XOF', periode: 'JOUR', actif: true,
      dateDebut: '2026-11-03' }]);
    component.meals = [{ key: 1, recetteId: 4, jour: 1, typeRepas: 'DEJEUNER', nombrePortions: 1 }];

    expect(component.budgetLines()[0].cost).toBeNull();
    expect(component.budgetComparable()).toBe(false);
    expect(component.budgetValidityError()).toContain('2026-11-02');
  });
});
