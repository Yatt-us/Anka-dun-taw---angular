import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { describeValidationMenuError } from './validation-menu-error';

describe('Messages de validation des menus', () => {
  it('transforme une indisponibilité datée en consigne claire', () => {
    const cause = new HttpErrorResponse({ status: 409, error: {
      message: "L'aliment « Mil local » n'est pas disponible le 2026-11-02 pour ce repas.",
    } });

    expect(describeValidationMenuError(cause, 'Erreur')).toBe(
      'Le produit « Mil local » n’est pas disponible le 2 novembre 2026. Choisissez une autre recette ou modifiez le jour du repas.',
    );
  });

  it('masque les détails techniques des erreurs serveur', () => {
    const cause = new HttpErrorResponse({ status: 500, error: { message: 'NullPointerException at com.example.MenuService' } });

    expect(describeValidationMenuError(cause, 'Impossible de charger la file des menus.'))
      .toBe('Le service rencontre un problème. Réessayez dans quelques instants.');
  });

  it('conserve le message de repli lorsque la réponse ne contient pas de détail métier reconnu', () => {
    const cause = new HttpErrorResponse({ status: 400, error: { message: 'invalid request payload' } });

    expect(describeValidationMenuError(cause, 'Validation ou publication impossible.'))
      .toBe('Validation ou publication impossible.');
  });
});
