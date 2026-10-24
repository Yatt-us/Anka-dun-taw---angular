const FOOD_FIELDS = [
  'nom', 'description', 'utilisation', 'uniteMesure', 'origine', 'categorieId', 'calories',
  'proteines', 'glucides', 'lipides', 'fibres', 'imageUrl', 'allergenes', 'allergenesVerifies',
  'moisDebutSaison', 'moisFinSaison',
] as const;

/** Keep explicit nulls on edits so optional food fields and seasons can be cleared. */
export function foodEditorPayload(model: Record<string, string | number | boolean | null>): Record<string, unknown> {
  return Object.fromEntries(FOOD_FIELDS
    .filter((key) => Object.hasOwn(model, key) && model[key] !== undefined)
    .map((key) => [key, model[key] === '' ? null : model[key]]));
}
