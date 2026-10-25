import { currencyLabel } from './workspace-formatters';

describe('currencyLabel', () => {
  it('affiche FCFA pour la devise XOF reçue de l’API', () => {
    expect(currencyLabel('XOF')).toBe('FCFA');
    expect(currencyLabel('xof')).toBe('FCFA');
    expect(currencyLabel('FCFA')).toBe('FCFA');
    expect(currencyLabel(null)).toBe('FCFA');
  });
});
