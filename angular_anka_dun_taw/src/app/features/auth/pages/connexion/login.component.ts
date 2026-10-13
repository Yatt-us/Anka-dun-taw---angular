import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserRole } from '../../../../core/auth/auth.models';
import { actorForRole } from '../../../../core/guards/actor-workspace.guard';
import { GoogleButtonComponent } from '../../components/google-button.component';

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
  readonly form = this.fb.nonNullable.group({
    identifiant: ['', Validators.required],
    motDePasse: ['', Validators.required],
  });
  readonly submitting = signal(false);
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    const { identifiant, motDePasse } = this.form.getRawValue();
    this.auth.login(identifiant, motDePasse).subscribe({
      next: (user) => this.finishLogin(user.role),
      error: (error: unknown) => {
        this.error.set(this.errorMessage(error));
        this.submitting.set(false);
      },
    });
  }

  loginWithGoogle(jetonId: string): void {
    if (this.submitting()) return;
    this.error.set(null);
    this.submitting.set(true);
    this.auth.loginWithGoogle(jetonId).subscribe({
      next: (user) => this.finishLogin(user.role),
      error: (error: unknown) => {
        this.error.set(this.googleErrorMessage(error));
        this.submitting.set(false);
      },
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

  private errorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'La connexion a échoué. Réessayez.';
    }
    if (error.status === 0) {
      return 'Le serveur est momentanément indisponible. Réessayez dans quelques instants.';
    }
    if (error.status === 200 && typeof error.error?.text === 'string'
      && error.error.text.toLowerCase().includes('<!doctype html')) {
      return 'Le site renvoie sa page d’accueil à la place de l’API. Vérifiez la configuration du relais /api sur Vercel.';
    }
    if (error.status === 429) {
      return 'Trop de tentatives de connexion. Réessayez plus tard.';
    }
    if (error.status === 401) {
      return 'E-mail, téléphone ou mot de passe incorrect.';
    }
    if (error.status >= 500) {
      return 'Le serveur a rencontré une erreur. Réessayez dans quelques instants.';
    }
    const apiMessage = typeof error.error?.message === 'string' ? error.error.message : null;
    return apiMessage ?? 'La connexion a échoué. Réessayez.';
  }
}
