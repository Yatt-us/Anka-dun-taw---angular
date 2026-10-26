/** Convertit un numéro saisi au format national en numéro Mali au format international. */
export function normaliserTelephoneMali(valeur: string | null | undefined): string | null {
  const compact = (valeur ?? '').trim().replace(/[\s().-]/g, '');
  if (!compact) return null;

  const chiffres = compact.replace(/\D/g, '');
  if (!chiffres) return null;
  if (compact.startsWith('+')) return `+${chiffres}`;
  if (compact.startsWith('00')) return `+${chiffres.slice(2)}`;

  // Accepte aussi un indicatif 223 collé manuellement, sans le dupliquer.
  if (chiffres.startsWith('223')) return `+${chiffres}`;
  return `+223${chiffres.replace(/^0(?=\d{8}$)/, '')}`;
}
