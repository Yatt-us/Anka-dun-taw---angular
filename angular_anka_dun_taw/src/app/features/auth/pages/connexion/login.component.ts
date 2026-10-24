import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserRole } from '../../../../core/auth/auth.models';
import { actorForRole } from '../../../../core/guards/actor-workspace.guard';
import { GoogleButtonComponent } from '../../components/google-button.component';
import { timer } from 'rxjs';

export function loginFailure(error: unknown): { message: string; verificationRequired: boolean } {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: 'La connexion a échoué. Réessayez.', verificationRequired: false };
  }
  if (error.status === 0) {
    return { message: 'Le serveur est momentanément indisponible. Réessayez dans quelques instants.', verificationRequired: false };
  }
  if (error.status === 200 && typeof error.error?.text === 'string'
    && error.error.text.toLowerCase().includes('<!doctype html')) {
    return { message: 'Le service de connexion est mal configuré. Contactez l’administrateur du site.', verificationRequired: false };
  }
  if (error.status === 429) {
    return { message: 'Trop de tentatives de connexion. Réessayez plus tard.', verificationRequired: false };
  }
  if (error.status === 401) {
    const verificationRequired = typeof error.error?.message === 'string'
      && error.error.message.includes('Confirmez votre adresse e-mail');
    return { message: verificationRequired
      ? 'Confirmez votre adresse e-mail avec le code reçu avant de vous connecter.'
      : 'E-mail, téléphone ou mot de passe incorrect.', verificationRequired };
  }
  if (error.status >= 500) {
    return { message: 'Le serveur a rencontré une erreur. Réessayez dans quelques instants.', verificationRequired: false };
  }
  const apiMessage = typeof error.error?.message === 'string' ? error.error.message : null;
  return { message: apiMessage ?? 'La connexion a échoué. Réessayez.', verificationRequired: false };
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, GoogleButtonComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private loginAttempt = 0;
  readonly form = this.fb.nonNullable.group({
    identifiant: ['', Validators.required],
    motDePasse: ['', Validators.required],
  });
  readonly submitting = signal(false);
  readonly slowConnection = signal(false);
  readonly verificationRequired = signal(false);
  readonly error = signal<string | null>(
    this.route.snapshot.queryParamMap.get('deconnexion') === 'echec'
      ? 'Votre compte ne dispose pas d’un espace professionnel et la déconnexion a échoué. Réessayez.'
      : this.route.snapshot.queryParamMap.get('acces') === 'refuse'
        ? 'Votre compte ne dispose pas d’un espace de travail professionnel.'
        : null,
  );
  readonly notice = this.route.snapshot.queryParamMap.get('motDePasse') === 'modifie'
    ? 'Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.' : '';

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.verificationRequired.set(false);
    this.beginSubmission();
    const { identifiant, motDePasse } = this.form.getRawValue();
    this.auth.login(identifiant, motDePasse).subscribe({
      next: (user) => this.finishLogin(user.role),
      error: (error: unknown) => {
        const failure = loginFailure(error);
        this.verificationRequired.set(failure.verificationRequired);
        this.error.set(failure.message);
        this.submitting.set(false);
      },
    });
  }

  loginWithGoogle(jetonId: string): void {
    if (this.submitting()) return;
    this.error.set(null);
    this.beginSubmission();
    this.auth.loginWithGoogle(jetonId).subscribe({
      next: (user) => this.finishLogin(user.role),
      error: (error: unknown) => {
        this.error.set(this.googleErrorMessage(error));
        this.submitting.set(false);
      },
    });
  }

  private beginSubmission(): void {
    const attempt = ++this.loginAttempt;
    this.slowConnection.set(false);
    this.submitting.set(true);
    timer(8000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (attempt === this.loginAttempt && this.submitting()) {
        this.slowConnection.set(true);
      }
    });
  }

  private googleErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'La connexion Google a échoué. Réessayez.';
    }
    if (error.status === 0) {
      return 'Le serveur est momentanément indisponible. Réessayez dans quelques instants.';
    }
    const apiMessage = typeof error.error?.message === 'string' ? error.error.message : null;
    if (error.status === 401) {
      return apiMessage ?? 'Google n’a pas pu confirmer votre identité. Réessayez avec le bouton Google.';
    }
    if (error.status === 409) {
      return apiMessage ?? 'Cette adresse e-mail existe déjà. Connectez-vous à ce compte puis associez Google dans les paramètres.';
    }
    if (error.status === 429) {
      return 'Trop de tentatives. Réessayez plus tard.';
    }
    return apiMessage ?? 'La connexion Google a échoué. Réessayez.';
  }

  private finishLogin(role: UserRole): void {
    const actor = actorForRole(role);
    if (!actor) {
      this.auth.logout().subscribe({
        next: () => {
          this.error.set('Ce compte n’a pas d’espace administrateur ou professionnel.');
          this.submitting.set(false);
        },
        error: () => {
          this.error.set('Ce compte n’a pas d’espace professionnel et sa session n’a pas pu être fermée. Réessayez.');
          this.submitting.set(false);
        },
      });
      return;
    }
    const requested = this.route.snapshot.queryParamMap.get('retour');
    const destination = requested?.startsWith(`/espaces/${actor}/`)
      ? requested
      : `/espaces/${actor}/tableau-de-bord`;
    if (actor === 'admin') {
      this.navigateAfterLogin(destination);
      return;
    }

    this.auth.checkProfessionalStatus(true).subscribe({
      next: (status) => this.navigateAfterLogin(
        status === 'VERIFIE' ? destination : '/espaces',
      ),
      error: () => this.navigateAfterLogin('/espaces'),
    });
  }

  private navigateAfterLogin(destination: string): void {
    void this.router.navigateByUrl(destination).finally(() => this.submitting.set(false));
  }

}
