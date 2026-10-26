import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { normaliserTelephoneMali } from './telephone-mali';
import {
  AuthenticatedUser,
  AuthenticationResponse,
  ProfessionalProfile,
  ProfessionalVerificationStatus,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly userState = signal<AuthenticatedUser | null>(null);
  readonly currentUser = this.userState.asReadonly();
  private readonly verificationState = signal<ProfessionalVerificationStatus | null>(null);
  readonly professionalStatus = this.verificationState.asReadonly();
  private readonly verificationErrorState = signal<string | null>(null);
  readonly professionalStatusError = this.verificationErrorState.asReadonly();

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private refreshRequest$: Observable<AuthenticationResponse> | null = null;
  private verificationRequest$: Observable<ProfessionalVerificationStatus | null> | null = null;

  /** Le JWT reste uniquement en mémoire ; le cookie de renouvellement est géré par le navigateur. */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  login(identifiant: string, motDePasse: string): Observable<AuthenticatedUser> {
    const value = identifiant.trim();
    const credentials = value.includes('@')
      ? { email: value, motDePasse }
      : { telephone: normaliserTelephoneMali(value), motDePasse };

    return this.http
      .post<AuthenticationResponse>(`${API_BASE_URL}/auth/connexion`, credentials, {
        withCredentials: true,
      })
      .pipe(map((response) => this.acceptAuthentication(response)));
  }

  loginWithGoogle(jetonId: string): Observable<AuthenticatedUser> {
    return this.http.post<AuthenticationResponse>(`${API_BASE_URL}/auth/google/connexion`,
      { jetonId }, { withCredentials: true }).pipe(map((response) => this.acceptAuthentication(response)));
  }

  signupProfessionalWithGoogle(jetonId: string, profile: {
    telephone: string | null;
    role: 'DIETETICIEN' | 'NUTRITIONNISTE';
    specialite: string;
    numeroOrdre: string | null;
    qualification: string;
    anneesExperience: number | null;
    biographie: string | null;
  }): Observable<AuthenticatedUser> {
    return this.http.post<AuthenticationResponse>(
      `${API_BASE_URL}/auth/google/inscription-professionnel`,
      { jetonId, ...profile },
      { withCredentials: true },
    ).pipe(map((response) => this.acceptAuthentication(response)));
  }

  /** Restaure la session au rechargement de page grâce au cookie HttpOnly. */
  ensureSession(): Observable<AuthenticatedUser | null> {
    if (this.currentUser() && this.accessToken && Date.now() < this.accessTokenExpiresAt - 5_000) {
      return of(this.currentUser());
    }
    return this.refreshSession().pipe(
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  /** Partage un seul renouvellement entre toutes les requêtes qui reçoivent un 401. */
  refreshSession(): Observable<AuthenticatedUser> {
    if (!this.refreshRequest$) {
      this.refreshRequest$ = this.http
        .post<AuthenticationResponse>(`${API_BASE_URL}/auth/rafraichir`, null, {
          withCredentials: true,
        })
        .pipe(
          tap((response) => this.acceptAuthentication(response)),
          finalize(() => (this.refreshRequest$ = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.refreshRequest$.pipe(map((response) => response.utilisateur));
  }

  /** Le profil professionnel expose le statut que /auth/moi ne renvoie pas. */
  checkProfessionalStatus(force = false): Observable<ProfessionalVerificationStatus | null> {
    const role = this.currentUser()?.role;
    if (role !== 'DIETETICIEN' && role !== 'NUTRITIONNISTE') {
      return of(null);
    }
    if (!force && this.verificationState()) {
      return of(this.verificationState());
    }
    if (!this.verificationRequest$) {
      this.verificationErrorState.set(null);
      this.verificationRequest$ = this.http
        .get<ProfessionalProfile>(`${API_BASE_URL}/professionnels/me`, { withCredentials: true })
        .pipe(
          map((profile) => profile.statutVerification),
          tap((status) => this.verificationState.set(status)),
          catchError(() => {
            this.verificationState.set(null);
            this.verificationErrorState.set(
              'Impossible de vérifier votre profil pour le moment. Réessayez.',
            );
            return of(null);
          }),
          finalize(() => (this.verificationRequest$ = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.verificationRequest$;
  }

  /** Appelé sur le 403 précis émis pour un professionnel en attente ou suspendu. */
  noteUnverifiedProfessional(): void {
    const role = this.currentUser()?.role;
    if (role === 'DIETETICIEN' || role === 'NUTRITIONNISTE') {
      this.verificationState.set(null);
      this.checkProfessionalStatus(true).subscribe();
    }
  }

  logout(): Observable<void> {
    const revoke = () =>
      this.http.post<void>(`${API_BASE_URL}/auth/deconnexion`, null, {
        withCredentials: true,
      });

    const sessionReady: Observable<void> =
      this.accessToken && Date.now() < this.accessTokenExpiresAt - 5_000
        ? of(void 0)
        : this.refreshSession().pipe(map(() => void 0));
    return sessionReady.pipe(
      switchMap(() =>
        revoke().pipe(
          catchError((error: unknown) =>
            error instanceof HttpErrorResponse && error.status === 401
              ? this.refreshSession().pipe(switchMap(() => revoke()))
              : throwError(() => error),
          ),
        ),
      ),
      tap(() => this.clearSession()),
    );
  }

  clearSession(): void {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    this.userState.set(null);
    this.verificationState.set(null);
    this.verificationErrorState.set(null);
  }

  private acceptAuthentication(response: AuthenticationResponse): AuthenticatedUser {
    this.accessToken = response.jeton;
    this.accessTokenExpiresAt = Date.parse(response.expireLe);
    this.userState.set(response.utilisateur);
    this.verificationState.set(null);
    this.verificationErrorState.set(null);
    return response.utilisateur;
  }
}
