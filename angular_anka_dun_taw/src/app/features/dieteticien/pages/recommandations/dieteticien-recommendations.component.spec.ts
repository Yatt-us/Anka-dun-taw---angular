import { describe, expect, it } from 'vitest';
import { DieteticienRecommendationsComponent } from './dieteticien-recommendations.component';

describe('Aperçu du patient dans les recommandations', () => {
  const view = Object.create(DieteticienRecommendationsComponent.prototype) as DieteticienRecommendationsComponent;

  it('présente les codes de l’objectif et de la région en français', () => {
    Reflect.set(view, 'activeGoal', () => ({ id: 7, type: 'ALIMENTATION_EQUILIBREE' }));
    Reflect.set(view, 'profile', () => ({ zone: 'TOMBOUCTOU' }));

    expect(view.goalName()).toBe('Alimentation équilibrée');
    expect(view.regionName()).toBe('Tombouctou');
  });

  it('garde un état lisible quand le profil est absent', () => {
    Reflect.set(view, 'activeGoal', () => null);
    Reflect.set(view, 'profile', () => null);

    expect(view.goalName()).toBe('Non renseigné');
    expect(view.regionName()).toBe('Non renseignée');
  });
});
