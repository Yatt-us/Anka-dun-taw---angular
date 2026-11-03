import { HttpErrorResponse } from '@angular/common/http';

/** Traduit les réponses techniques de l’API en consignes utiles au diététicien. */
export function describeValidationMenuError(cause: unknown, fallback: string): string {
  if (!(cause instanceof HttpErrorResponse)) return fallback;

  const message = typeof cause.error?.message === 'string' ? cause.error.message : '';
  const unavailable = message.match(/L'aliment\s+[«"'](.+?)[»"']\s+n'est pas disponible(?:\s+le\s+(\d{4}-\d{2}-\d{2})\s+pour ce repas|\s+à la date du repas)\.?/i);
  if (unavailable) {
    const date = unavailable[2] ? ` le ${formatDate(unavailable[2])}` : '';
    return `Le produit « ${unavailable[1].trim()} » n’est pas disponible${date}. Choisissez une autre recette ou modifiez le jour du repas.`;
  }

  // Ne pas exposer au diététicien les détails d’implémentation renvoyés par le serveur.
  if (cause.status === 0) return 'Le service est momentanément injoignable. Vérifiez votre connexion puis réessayez.';
  if (cause.status >= 500) return 'Le service rencontre un problème. Réessayez dans quelques instants.';
  if (cause.status === 401 || cause.status === 403) return 'Votre session ne permet plus cette action. Reconnectez-vous puis réessayez.';
  return fallback;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, day));
}
