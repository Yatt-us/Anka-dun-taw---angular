import { UiIconComponent } from '../../../shared/components/ui-icon.component';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { actorForRole } from '../../../core/guards/actor-workspace.guard';
import { ActorId } from '../../../shared/components/workspace-config';

@Component({
  selector: 'app-workspace-selector',
  imports: [RouterLink, UiIconComponent],
  templateUrl: './workspace-selector.component.html',
  styleUrl: './workspace-selector.component.css',
})
export class WorkspaceSelectorComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly logoutError = signal<string | null>(null);
  readonly displayName = computed(() => {
    const user = this.auth.currentUser();
    return user ? `${user.prenom} ${user.nom}`.trim() : '';
  });
  readonly ownActor = computed(() => {
    const user = this.auth.currentUser();
    return user ? actorForRole(user.role) : null;
  });
  readonly notice = computed(() => {
    if (this.auth.professionalStatusError()) {
      return this.auth.professionalStatusError();
    }
    switch (this.auth.professionalStatus()) {
      case 'EN_ATTENTE':
        return 'Votre dossier professionnel attend sa vérification. Votre espace sera disponible après validation.';
      case 'REFUSE':
        return 'La vérification de votre dossier professionnel a été refusée. Contactez l’administration.';
      case 'SUSPENDU':
        return 'Votre accès professionnel est suspendu. Contactez l’administration.';
      default:
        return null;
    }
  });

  canOpen(actor: ActorId): boolean {
    const user = this.auth.currentUser();
    return (
      !!user &&
      actorForRole(user.role) === actor &&
      (actor === 'admin' || this.auth.professionalStatus() === 'VERIFIE')
    );
  }

  retryVerification(): void {
    this.auth.checkProfessionalStatus(true).subscribe();
  }

  logout(): void {
    this.logoutError.set(null);
    this.auth.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('/connexion');
      },
      error: () =>
        this.logoutError.set('La session reste active. Réessayez dans quelques instants.'),
    });
  }
}
