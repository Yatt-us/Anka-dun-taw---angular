import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { AuthService } from '../../../../core/auth/auth.service';
import { GoogleButtonComponent } from '../../components/google-button.component';

type Mode = 'inscription' | 'oubli' | 'reinitialisation';

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
  readonly mode = signal<Mode>(this.route.snapshot.queryParamMap.get('action') === 'oubli' ? 'oubli' : 'inscription');
  readonly signupMethod = signal<'password' | 'google'>('password');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly title = computed(() => ({ inscription: 'Créer un compte professionnel', oubli: 'Mot de passe oublié', reinitialisation: 'Définir un nouveau mot de passe' })[this.mode()]);
  readonly description = computed(() => ({ inscription: 'Diététicien ou nutritionniste : renseignez vos informations professionnelles.', oubli: 'Recevez un code pour retrouver l’accès à votre compte.', reinitialisation: 'Utilisez le code reçu pour choisir un nouveau mot de passe.' })[this.mode()]);
  nom = ''; prenom = ''; email = ''; telephone = ''; motDePasse = ''; role = 'DIETETICIEN'; specialite = ''; numeroOrdre = ''; qualification = ''; anneesExperience: number | null = null; biographie = '';
  recoveryEmail = ''; resetToken = ''; newPassword = '';

  setMode(mode: Mode): void { this.mode.set(mode); this.error.set(''); this.success.set(''); }
  setSignupMethod(method: 'password' | 'google'): void {
    this.signupMethod.set(method);
    this.error.set('');
    this.success.set('');
  }
  signup(valid: boolean): void {
    if (this.signupMethod() !== 'password') return;
    if (!valid || (!this.email.trim() && !this.telephone.trim())) { this.error.set('Renseignez au moins une adresse e-mail ou un téléphone et les champs obligatoires.'); return; }
    this.send('/auth/inscription-professionnel', { nom: this.nom.trim(), prenom: this.prenom.trim(), email: this.email.trim() || null,
      telephone: this.telephone.trim() || null, motDePasse: this.motDePasse, role: this.role, specialite: this.specialite.trim(),
      numeroOrdre: this.numeroOrdre.trim() || null, qualification: this.qualification.trim(), anneesExperience: this.anneesExperience,
      biographie: this.biographie.trim() }, 'Compte créé. La vérification par l’administrateur est en attente.');
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
