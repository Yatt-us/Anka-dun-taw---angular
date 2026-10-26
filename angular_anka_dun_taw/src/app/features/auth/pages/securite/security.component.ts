import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { GoogleButtonComponent } from '../../components/google-button.component';

@Component({
  selector: 'app-security',
  imports: [FormsModule, GoogleButtonComponent],
  templateUrl: './security.component.html',
  styleUrl: './security.component.css',
})
export class SecurityComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmationPassword = signal(false);
  readonly error = signal('');
  readonly googleSuccess = signal(false);
  currentPassword = '';
  newPassword = '';
  confirmationPassword = '';
  change(valid: boolean): void {
    if (!valid) { this.error.set('Renseignez les champs requis. Le nouveau mot de passe doit contenir au moins huit caractères.'); return; }
    if (this.newPassword !== this.confirmationPassword) { this.error.set('Les deux nouveaux mots de passe ne correspondent pas.'); return; }
    if (this.currentPassword === this.newPassword) { this.error.set('Le nouveau mot de passe doit être différent de l’actuel.'); return; }
    this.busy.set(true); this.error.set('');
    this.http.post(`${API_BASE_URL}/auth/mot-de-passe/changer`, {
      motDePasseActuel: this.currentPassword, nouveauMotDePasse: this.newPassword,
    }, { withCredentials: true }).subscribe({
      next: () => { this.currentPassword = ''; this.newPassword = ''; this.confirmationPassword = ''; this.auth.clearSession(); void this.router.navigate(['/connexion'], { queryParams: { motDePasse: 'modifie' } }); },
      error: (error: unknown) => { this.busy.set(false); this.error.set(error instanceof HttpErrorResponse && typeof error.error?.message === 'string' ? error.error.message : 'Modification impossible. Vérifiez le mot de passe actuel.'); },
    });
  }

  linkGoogle(jetonId: string): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.googleSuccess.set(false);
    this.http.post<void>(`${API_BASE_URL}/auth/google/lier`, { jetonId }).subscribe({
      next: () => { this.busy.set(false); this.googleSuccess.set(true); },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message : 'Association Google impossible. Réessayez.');
      },
    });
  }
}
