import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('Routes de l’espace diététicien', () => {
  it('associe la liste des menus à la rubrique autorisée malgré son chemin enfant vide', () => {
    const workspace = routes.find((route) => route.path === 'espaces/:actor');
    const menus = workspace?.children?.find((route) => route.path === 'menus');
    const list = menus?.children?.find((route) => route.path === '');

    expect(list?.data?.['section']).toBe('menus');
  });
});
