import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { actorForRole } from '../../../core/guards/actor-workspace.guard';
import { ActorId } from '../../../shared/components/workspace-config';

@Component({
  selector: 'app-workspace-selector',
  imports: [RouterLink],
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
  readonly isProfessional = computed(() => {
    const actor = this.ownActor();
    return actor === 'dieteticien' || actor === 'nutritionniste';
  });
  readonly verificationView = computed(() => {
    if (!this.isProfessional()) return null;

    const status = this.auth.professionalStatus();
    if (status === 'VERIFIE') return null;

    // Les professionnels non validés restent sur un écran explicite au lieu
    // de voir une carte d’espace simplement grisée.
    if (this.auth.professionalStatusError()) {
      return {
        kind: 'error',
        heading: 'Impossible de vérifier',
        accent: 'votre dossier',
        noticeTitle: 'Vérification indisponible',
        description: this.auth.professionalStatusError()!,
      };
    }

    switch (status) {
      case 'EN_ATTENTE':
        return {
          kind: 'pending',
          heading: 'Bienvenue dans votre',
          accent: 'espace de travail',
          noticeTitle: 'Accès à votre espace',
          description:
            'Votre dossier professionnel attend sa vérification. Votre espace sera disponible après validation',
        };
      case 'REFUSE':
        return {
          kind: 'rejected',
          heading: 'Votre demande n’a pas été',
          accent: 'acceptée',
          noticeTitle: 'Dossier professionnel refusé',
          description:
            'L’accès professionnel n’est pas activé pour ce compte. Contactez l’équipe Anka Dùn Taw pour connaître la suite à donner à votre dossier.',
        };
      case 'SUSPENDU':
        return {
          kind: 'suspended',
          heading: 'Votre accès professionnel est',
          accent: 'suspendu',
          noticeTitle: 'Espace professionnel suspendu',
          description:
            'Votre compte professionnel ne peut pas ouvrir l’espace pour le moment. Contactez l’équipe Anka Dùn Taw pour obtenir de l’aide.',
        };
      default:
        return {
          kind: 'checking',
          heading: 'Bienvenue dans votre',
          accent: 'espace de travail',
          noticeTitle: 'Vérification du profil',
          description:
            'Le statut de votre inscription est en cours de chargement. Vous pouvez actualiser la vérification dans quelques instants.',
        };
    }
  });
  readonly checkingStatus = signal(false);
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
    this.checkingStatus.set(true);
    this.auth.checkProfessionalStatus(true).subscribe({
      complete: () => this.checkingStatus.set(false),
    });
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
