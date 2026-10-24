import { describe, expect, it } from 'vitest';
import { currencyLabel } from './workspace-formatters';

describe('currencyLabel', () => {
  it('affiche FCFA pour le code API XOF', () => {
    expect(currencyLabel('XOF')).toBe('FCFA');
    expect(currencyLabel('xof')).toBe('FCFA');
    expect(currencyLabel()).toBe('FCFA');
  });

  it('conserve les autres codes de devise', () => {
    expect(currencyLabel('EUR')).toBe('EUR');
  });
});
