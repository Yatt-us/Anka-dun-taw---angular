import { MatButtonModule } from '@angular/material/button';
import { Component, computed, inject, signal } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ACTORS, isActorId } from './workspace-config';
import { UiIconComponent } from './ui-icon.component';

@Component({
  selector: 'app-workspace-layout',
  imports: [MatButtonModule, RouterLink, RouterLinkActive, RouterOutlet, UiIconComponent],
  templateUrl: './workspace-layout.component.html',
  styleUrls: ['./workspace-layout.component.css', './workspace-admin-layout.component.css', './workspace-nutrition-layout.component.css'],
})
export class WorkspaceLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly actorId = toSignal(this.route.paramMap.pipe(map((p) => p.get('actor'))), {
    initialValue: this.route.snapshot.paramMap.get('actor'),
  });
  readonly actor = computed(() => {
    const id = this.actorId();
    return ACTORS[isActorId(id) ? id : 'admin'];
  });
  readonly primaryNavigation = computed(() => this.actor().navigation);
  readonly menuOpen = signal(false);
  readonly logoutError = signal<string | null>(null);
  readonly profilePhotoError = signal(false);
  readonly profileName = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return 'Mon compte';
    if (this.actor().id === 'admin') return `${user.prenom?.[0] ?? ''}. ${user.nom}`.trim();
    return `${user.prenom} ${user.nom}`.trim();
  });
  readonly profileInitials = computed(() => {
    const user = this.auth.currentUser();
    return user ? `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toLocaleUpperCase('fr') : '';
  });
  readonly profilePhoto = computed(() => this.profilePhotoError() ? null : this.auth.currentUser()?.photoProfilUrl || null);

  logout(): void {
    this.logoutError.set(null);
    this.auth.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('/connexion');
      },
      error: () => this.logoutError.set('Déconnexion impossible. Votre session reste active.'),
    });
  }
}
