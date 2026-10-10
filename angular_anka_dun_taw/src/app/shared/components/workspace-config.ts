export type ActorId = 'admin' | 'dieteticien' | 'nutritionniste';

export interface NavigationItem {
  label: string;
  path: string;
  icon: string;
}

export interface ActorConfig {
  id: ActorId;
  title: string;
  shortTitle: string;
  description: string;
  initials: string;
  accent: string;
  navigation: NavigationItem[];
}

export const ACTORS: Record<ActorId, ActorConfig> = {
  admin: {
    id: 'admin',
    title: 'Administration',
    shortTitle: 'Administrateur',
    description: 'Gérez la plateforme et ses contenus.',
    initials: 'AD',
    accent: 'green',
    navigation: [
      { label: 'Vue d’ensemble', path: 'tableau-de-bord', icon: 'home' },
      { label: 'Utilisateurs', path: 'utilisateurs', icon: 'users' },
      { label: 'Professionnels', path: 'professionnels', icon: 'pro' },
      { label: 'Aliments locaux', path: 'aliments', icon: 'leaf' },
      { label: 'Catégories', path: 'categories', icon: 'grid' },
      { label: 'Recettes', path: 'recettes', icon: 'book' },
      { label: 'Menus à modérer', path: 'menus', icon: 'book' },
      { label: 'Contenus éducatifs', path: 'contenus', icon: 'book' },
      { label: 'Quiz', path: 'quiz', icon: 'book' },
      { label: 'Défis', path: 'defis', icon: 'chart' },
      { label: 'Badges', path: 'badges', icon: 'grid' },
      { label: 'Historique', path: 'historique', icon: 'clock' },
      { label: 'Notifications', path: 'notifications', icon: 'message' },
      { label: 'Paramètres', path: 'parametres', icon: 'settings' },
    ],
  },
  dieteticien: {
    id: 'dieteticien',
    title: 'Espace diététicien(ne)',
    shortTitle: 'Diététicien(ne)',
    description: 'Créez des menus adaptés aux besoins et au budget de vos patients.',
    initials: 'DT',
    accent: 'orange',
    navigation: [
      { label: 'Vue d’ensemble', path: 'tableau-de-bord', icon: 'home' },
      { label: 'Mes patients', path: 'patients', icon: 'users' },
      { label: 'Créer un menu', path: 'menus', icon: 'plus' },
      { label: 'Adaptations', path: 'demandes-adaptation', icon: 'refresh' },
      { label: 'Recettes locales', path: 'recettes', icon: 'book' },
      { label: 'Portions & coûts', path: 'portions-couts', icon: 'clock' },
      { label: 'Suivi des patients', path: 'suivi-utilisateurs', icon: 'chart' },
      { label: 'Rendez-vous', path: 'rendez-vous', icon: 'calendar' },
      { label: 'Disponibilités', path: 'disponibilites', icon: 'clock' },
      { label: 'Messages', path: 'messages', icon: 'message' },
      { label: 'Notifications', path: 'notifications', icon: 'message' },
      { label: 'Mon profil', path: 'profil', icon: 'user' },
    ],
  },
  nutritionniste: {
    id: 'nutritionniste',
    title: 'Espace nutritionniste',
    shortTitle: 'Nutritionniste',
    description: 'Accompagnez les patients avec des conseils et des consultations.',
    initials: 'NT',
    accent: 'yellow',
    navigation: [
      { label: 'Vue d’ensemble', path: 'tableau-de-bord', icon: 'grid' },
      { label: 'Questions utilisateurs', path: 'questions', icon: 'message' },
      { label: 'Patients en contact', path: 'patients', icon: 'users' },
      { label: 'Conseils nutritionnels', path: 'recommandations', icon: 'book' },
      { label: 'Demandes de consultation', path: 'consultations', icon: 'refresh' },
      { label: 'Rendez-vous', path: 'rendez-vous', icon: 'calendar' },
      { label: 'Disponibilités', path: 'disponibilites', icon: 'clock' },
      { label: 'Notifications', path: 'notifications', icon: 'message' },
      { label: 'Mon profil', path: 'profil', icon: 'user' },
    ],
  },
};

export function isActorId(value: string | null): value is ActorId {
  return value === 'admin' || value === 'dieteticien' || value === 'nutritionniste';
}
