import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ACTORS, isActorId } from './workspace-config';
import { UiIconComponent } from './ui-icon.component';
@Component({
  selector: 'app-workspace-layout',
  imports: [
    MatButtonModule,
    MatMenuModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    UiIconComponent,
  ],
  templateUrl: './workspace-layout.component.html',
  styleUrl: './workspace-layout.component.css',
})
export class WorkspaceLayoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly actorId = toSignal(this.route.paramMap.pipe(map((p) => p.get('actor'))), {
    initialValue: this.route.snapshot.paramMap.get('actor'),
  });
  readonly actor = computed(() => {
    const id = this.actorId();
    return ACTORS[isActorId(id) ? id : 'admin'];
  });
  readonly menuOpen = signal(false);
  readonly profileName = computed(() =>
    this.actor().id === 'admin'
      ? 'S. Coulibaly'
      : this.actor().id === 'dieteticien'
        ? 'Dr. M. Coulibaly'
        : 'Dr. A. Traoré',
  );
  readonly profileInitials = computed(() =>
    this.actor().id === 'admin' ? 'SC' : this.actor().id === 'dieteticien' ? 'MC' : 'AT',
  );
}
