import { describe, expect, it } from 'vitest';
import { PatientsComponent } from './patients.component';

describe('Affichage du dossier patient', () => {
  const view = PatientsComponent.prototype;

  it('arrondit l’IMC du profil et garde une valeur absente lisible', () => {
    expect(view.imcLabel(24.913494809688583)).toBe('24,9');
    expect(view.imcLabel(undefined)).toBe('—');
  });

  it('traduit les valeurs du profil et du budget pour le diététicien', () => {
    expect(view.activityLabel('TRES_ELEVE')).toBe('Très élevée');
    expect(view.budgetModeLabel('AVEC_BUDGET')).toBe('Budget défini');
    expect(view.goalLabel({ id: 1, type: 'ALIMENTATION_EQUILIBREE' })).toBe('Alimentation équilibrée');
    expect(view.budgetPeriodLabel('SEMAINE')).toBe('semaine');
  });
});
