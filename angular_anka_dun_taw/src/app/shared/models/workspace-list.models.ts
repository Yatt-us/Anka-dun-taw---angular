export interface WorkspaceRow {
  key: string;
  title: string;
  subtitle: string;
  value: string;
  badge: string;
  badgeTone: 'green' | 'orange' | 'yellow' | 'red' | 'neutral';
  imageUrl?: string | null;
  data?: Record<string, unknown>;
  detail?: WorkspaceDetailConfig;
}

export interface WorkspaceDetailConfig {
  kind?: 'food' | 'badge' | 'challenge' | 'appointment' | 'conversation';
  editKind?: 'category' | 'food' | 'recipe' | 'quiz' | 'challenge' | 'advice' | 'article' | 'menu' | 'profile';
  showPriceList?: boolean;
  showPriceCreate?: boolean;
  showBadgeAssignment?: boolean;
  showChallengeProgress?: boolean;
  showAppointmentComment?: boolean;
  showConversation?: boolean;
  commentLabel?: string;
}

export interface WorkspacePageResult {
  rows: WorkspaceRow[];
  total: number;
  hint?: string;
}

export interface ApiPage<T> {
  content: T[];
  totalElements: number;
}

export interface FoodPrice {
  id: number;
  alimentId?: number;
  zone: string;
  prix: number;
  devise?: string;
  quantiteReference?: number;
  unite?: string;
  dateDebut?: string;
  dateFin?: string;
}

export interface ProfessionalMessage {
  id: number;
  contenu: string;
  auteurNom?: string;
  auteurPrenom?: string;
  dateEnvoi?: string;
}

export interface WorkspaceAction {
  label: string;
  path: string;
  comment?: boolean;
  method?: 'DELETE' | 'PUT';
}
