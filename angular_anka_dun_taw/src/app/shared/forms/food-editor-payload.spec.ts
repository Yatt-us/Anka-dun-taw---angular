import { describe, expect, it } from 'vitest';
import { foodEditorPayload } from './food-editor-payload';

describe('payload du formulaire aliment', () => {
  it('conserve les champs optionnels vides pour permettre leur effacement', () => {
    expect(foodEditorPayload({ nom: 'Carotte', description: '', imageUrl: null,
      moisDebutSaison: null, moisFinSaison: null, allergenes: '', allergenesVerifies: false }))
      .toEqual({ nom: 'Carotte', description: null, imageUrl: null,
        moisDebutSaison: null, moisFinSaison: null, allergenes: null, allergenesVerifies: false });
  });

  it('préserve les nombres, les booléens et ne transmet pas des champs inconnus', () => {
    expect(foodEditorPayload({ nom: 'Mil', categorieId: 3, calories: 356, allergenesVerifies: true,
      id: 12 } as Record<string, string | number | boolean | null>))
      .toEqual({ nom: 'Mil', categorieId: 3, calories: 356, allergenesVerifies: true });
  });
});
