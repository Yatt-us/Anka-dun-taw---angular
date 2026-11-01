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
import { catchError, map, of, switchMap, timer } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationListDataAccess } from '../data-access/notification-list.data-access';
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
  private readonly notifications = inject(NotificationListDataAccess);
  // Le compteur est rechargé régulièrement ; le repli à zéro masque l'indicateur si l'API est indisponible.
  readonly unreadNotificationCount = toSignal(
    timer(0, 30_000).pipe(
      switchMap(() => this.notifications.unreadCount().pipe(catchError(() => of(0)))),
    ),
    { initialValue: 0 },
  );
  private readonly actorId = toSignal(this.route.paramMap.pipe(map((p) => p.get('actor'))), {
    initialValue: this.route.snapshot.paramMap.get('actor'),
  });
  readonly actor = computed(() => {
    const id = this.actorId();
    return ACTORS[isActorId(id) ? id : 'admin'];
  });
  readonly primaryNavigation = computed(() => this.actor().navigation);
  readonly menuOpen = signal(false);
  // Le rail professionnel reste compact tant que l'utilisateur ne demande pas les libellés.
  readonly professionalSidebarOpen = signal(false);
  // Les groupes secondaires commencent fermés ; un clic sur leur titre inverse leur état.
  readonly expandedGroup = signal<string | null>(null);
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

  /** Transforme les chemins de configuration en segments Angular distincts. */
  workspaceLink(path: string): string[] {
    return ['/espaces', this.actor().id, ...path.split('/').filter(Boolean)];
  }

  toggleGroup(path: string): void {
    this.expandedGroup.update((current) => current === path ? null : path);
    if (this.expandedGroup() === path) {
      // L'ouverture se fait en bas du rail : on défile uniquement la liste des liens.
      requestAnimationFrame(() => {
        const navigation = document.getElementById('workspace-primary-navigation');
        navigation?.scrollTo({ top: navigation.scrollHeight, behavior: 'smooth' });
      });
    }
  }

  toggleProfessionalSidebar(): void {
    this.professionalSidebarOpen.update((open) => !open);
  }

  logout(): void {
    this.logoutError.set(null);
    this.auth.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('/connexion');
      },
      error: () => {
        this.logoutError.set('Déconnexion impossible. Votre session reste active.');
        // Dévoile le message même si le rail professionnel était réduit.
        if (this.actor().id !== 'admin') this.professionalSidebarOpen.set(true);
      },
    });
  }
}
