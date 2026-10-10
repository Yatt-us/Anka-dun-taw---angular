import { WorkspaceRow } from '../models/workspace-list.models';

const STATUS_LABELS: Record<string, string> = {
  ACTIF: 'Actif', DESACTIVE: 'Désactivé', SUSPENDU: 'Suspendu', VERIFIE: 'Vérifié',
  EN_ATTENTE: 'En attente', EN_COURS: 'En cours', REFUSE: 'Refusé', REFUSEE: 'Refusée', DEMANDE: 'Demandé',
  ACCEPTE: 'Accepté', ANNULE: 'Annulé', TERMINE: 'Terminé', TRAITEE: 'Traitée',
  BROUILLON: 'Brouillon', EN_VALIDATION: 'En validation', VALIDE: 'Validé',
  PUBLIE: 'Publié', PUBLIEE: 'Publiée', ARCHIVE: 'Archivé', ARCHIVEE: 'Archivée',
  SUCCES: 'Succès', ECHEC: 'Échec',
};

export function formatStatusLabel(value?: string | null): string {
  return value ? STATUS_LABELS[value] ?? value.replaceAll('_', ' ').toLocaleLowerCase('fr') : 'Non renseigné';
}

export function statusBadge(value?: string | null): Pick<WorkspaceRow, 'badge' | 'badgeTone'> {
  const good = ['ACTIF', 'VERIFIE', 'ACCEPTE', 'TERMINE', 'TRAITEE', 'VALIDE', 'PUBLIE', 'PUBLIEE', 'SUCCES'];
  const bad = ['REFUSE', 'REFUSEE', 'ANNULE', 'DESACTIVE', 'SUSPENDU', 'ARCHIVE', 'ARCHIVEE', 'ECHEC'];
  const badgeTone = !value ? 'neutral' : good.includes(value) ? 'green' : bad.includes(value) ? 'red' :
    ['BROUILLON', 'EN_VALIDATION'].includes(value) ? 'yellow' : 'orange';
  return { badge: formatStatusLabel(value), badgeTone };
}

export function fullPersonName(person: { prenom?: string; nom?: string }): string {
  return [person.prenom, person.nom].filter(Boolean).join(' ') || 'Nom non renseigné';
}

export function shortSummary(value?: string | null): string {
  const text = value?.trim();
  return text ? (text.length > 110 ? `${text.slice(0, 107)}…` : text) : 'Aucune description';
}

export function formatApiDate(value?: string | null): string {
  if (!value) return 'Date non renseignée';
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium', ...(value.length > 10 ? { timeStyle: 'short' as const } : {}),
  }).format(parsed);
}
