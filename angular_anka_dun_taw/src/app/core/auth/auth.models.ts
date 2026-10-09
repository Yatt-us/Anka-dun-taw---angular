export type UserRole = 'ADMIN' | 'DIETETICIEN' | 'NUTRITIONNISTE' | 'UTILISATEUR';
export type UserStatus = 'ACTIF' | 'SUSPENDU' | 'DESACTIVE';
export type ProfessionalVerificationStatus = 'EN_ATTENTE' | 'VERIFIE' | 'REFUSE' | 'SUSPENDU';

export interface AuthenticatedUser {
  id: number;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  photoProfilUrl: string | null;
  statut: UserStatus;
  role: UserRole;
  derniereConnexion: string | null;
}

export interface AuthenticationResponse {
  jeton: string;
  expireLe: string;
  utilisateur: AuthenticatedUser;
}

export interface ProfessionalProfile {
  statutVerification: ProfessionalVerificationStatus;
}
