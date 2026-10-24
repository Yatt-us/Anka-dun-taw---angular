import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { AuthService } from '../../../../core/auth/auth.service';
import { GoogleButtonComponent } from '../../components/google-button.component';

type Mode = 'inscription' | 'verification' | 'oubli' | 'reinitialisation';

@Component({
  selector: 'app-account-actions',
  imports: [FormsModule, RouterLink, GoogleButtonComponent],
  templateUrl: './account-actions.component.html',
  styleUrl: './account-actions.component.css',
})
export class AccountActionsComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly mode = signal<Mode>(this.route.snapshot.queryParamMap.get('action') === 'oubli' ? 'oubli'
    : this.route.snapshot.queryParamMap.get('action') === 'verification' ? 'verification' : 'inscription');
  readonly signupMethod = signal<'password' | 'google'>('password');
  readonly signupStep = signal<1 | 2>(1);
  readonly emailVerified = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly title = computed(() => ({ inscription: 'Créer un compte professionnel', verification: 'Vérifier mon e-mail', oubli: 'Mot de passe oublié', reinitialisation: 'Définir un nouveau mot de passe' })[this.mode()]);
  readonly description = computed(() => ({ inscription: 'Diététicien ou nutritionniste : renseignez vos informations professionnelles.', verification: 'Recevez un code pour confirmer l’adresse e-mail de votre compte.', oubli: 'Recevez un code pour retrouver l’accès à votre compte.', reinitialisation: 'Utilisez le code reçu pour choisir un nouveau mot de passe.' })[this.mode()]);
  nom = ''; prenom = ''; email = this.route.snapshot.queryParamMap.get('email') ?? ''; telephone = ''; motDePasse = ''; confirmationMotDePasse = ''; role = 'DIETETICIEN'; specialite = ''; numeroOrdre = ''; qualification = ''; anneesExperience: number | null = null; biographie = '';
  recoveryEmail = ''; resetToken = ''; newPassword = '';
  verificationCode = '';

  setMode(mode: Mode): void { this.mode.set(mode); this.error.set(''); this.success.set(''); }
  setSignupMethod(method: 'password' | 'google'): void {
    this.signupMethod.set(method);
    this.signupStep.set(method === 'google' ? 2 : 1);
    this.error.set('');
    this.success.set('');
  }
  continueSignup(valid: boolean): void {
    const error = this.personalDetailsError(valid);
    if (error) { this.error.set(error); return; }
    this.error.set('');
    this.signupStep.set(2);
  }

  private personalDetailsError(valid = true): string | null {
    if (!valid || !this.prenom.trim() || !this.nom.trim() || this.motDePasse.length < 8) {
      return 'Complétez les champs obligatoires. Le mot de passe doit contenir au moins huit caractères.';
    }
    if (this.motDePasse !== this.confirmationMotDePasse) {
      return 'Les deux mots de passe ne correspondent pas.';
    }
    return null;
  }
  signup(valid: boolean): void {
    if (this.signupMethod() !== 'password') return;
    const personalError = this.personalDetailsError();
    if (personalError) { this.error.set(personalError); this.signupStep.set(1); return; }
    if (!this.email.trim() && !this.telephone.trim()) { this.error.set('Renseignez une adresse e-mail ou un numéro de téléphone.'); return; }
    if (!valid) { this.error.set('Complétez les informations professionnelles obligatoires.'); return; }
    this.send('/auth/inscription-professionnel', { nom: this.nom.trim(), prenom: this.prenom.trim(), email: this.email.trim() || null,
      telephone: this.telephone.trim() || null, motDePasse: this.motDePasse, role: this.role, specialite: this.specialite.trim(),
      numeroOrdre: this.numeroOrdre.trim() || null, qualification: this.qualification.trim(), anneesExperience: this.anneesExperience,
      biographie: this.biographie.trim() }, 'Compte créé. La vérification par l’administrateur est en attente.');
  }
  requestExistingEmailCode(valid: boolean): void {
    if (!valid || !this.email.trim()) { this.error.set('Saisissez une adresse e-mail valide.'); return; }
    this.busy.set(true); this.error.set(''); this.success.set('');
    this.http.post(`${API_BASE_URL}/auth/email-verification/demander`, { email: this.email.trim() })
      .subscribe({
        next: () => { this.busy.set(false); this.success.set('Si cette adresse correspond à un compte à vérifier, un code vient d’être envoyé.'); },
        error: (error: unknown) => {
          this.busy.set(false);
          this.error.set(error instanceof HttpErrorResponse && error.status === 503
            ? 'L’envoi des codes est momentanément indisponible. Réessayez plus tard.'
            : 'Impossible d’envoyer le code pour le moment. Réessayez dans une minute.');
        },
      });
  }
  confirmExistingEmail(valid: boolean): void {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) {
      this.error.set('Saisissez une adresse e-mail valide.'); return;
    }
    if (!valid || !/^\d{6}$/.test(this.verificationCode.trim())) {
      this.error.set('Saisissez le code à six chiffres reçu par e-mail.'); return;
    }
    this.busy.set(true); this.error.set(''); this.success.set('');
    this.http.post(`${API_BASE_URL}/auth/email-verification/confirmer`,
      { email: this.email.trim(), code: this.verificationCode.trim() }).subscribe({
      next: () => { this.busy.set(false); this.emailVerified.set(true); this.success.set('Adresse vérifiée. Vous pouvez maintenant vous connecter.'); },
      error: () => { this.busy.set(false); this.error.set('Code invalide ou expiré. Demandez un nouveau code.'); },
    });
  }
  signupWithGoogle(jetonId: string, valid: boolean): void {
    if (this.signupMethod() !== 'google' || this.busy()) return;
    if (!valid) {
      this.error.set('Complétez le type de compte, la spécialité et la qualification avant de continuer avec Google.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    this.auth.signupProfessionalWithGoogle(jetonId, {
      telephone: this.telephone.trim() || null,
      role: this.role as 'DIETETICIEN' | 'NUTRITIONNISTE',
      specialite: this.specialite.trim(),
      numeroOrdre: this.numeroOrdre.trim() || null,
      qualification: this.qualification.trim(),
      anneesExperience: this.anneesExperience,
      biographie: this.biographie.trim() || null,
    }).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl('/espaces');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message
          : 'Inscription Google impossible. Vérifiez votre connexion et réessayez.');
      },
    });
  }
  forgot(valid: boolean): void {
    if (!valid) { this.error.set('Saisissez une adresse e-mail valide.'); return; }
    this.send('/auth/mot-de-passe/oublie', { email: this.recoveryEmail.trim() }, 'Si ce compte existe, des instructions ont été envoyées.');
  }
  reset(valid: boolean): void {
    if (!valid) { this.error.set('Saisissez le code et un mot de passe d’au moins huit caractères.'); return; }
    this.send('/auth/mot-de-passe/reinitialiser', { jeton: this.resetToken.trim(), nouveauMotDePasse: this.newPassword }, 'Mot de passe changé. Vous pouvez vous connecter.');
  }
  private send(path: string, body: object, message: string): void {
    this.busy.set(true); this.error.set(''); this.success.set('');
    this.http.post(`${API_BASE_URL}${path}`, body).subscribe({
      next: () => { this.busy.set(false); this.success.set(message); },
      error: (error: unknown) => { this.busy.set(false); this.error.set(error instanceof HttpErrorResponse && typeof error.error?.message === 'string' ? error.error.message : 'Opération impossible. Vérifiez vos informations.'); },
    });
  }
}
