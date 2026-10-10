import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AdminDashboardComponent } from '../../features/admin/pages/tableau-de-bord/admin-dashboard.component';
import { DieteticienDashboardComponent } from '../../features/dieteticien/pages/tableau-de-bord/dieteticien-dashboard.component';
import { NutritionnisteDashboardComponent } from '../../features/nutritionniste/pages/tableau-de-bord/nutritionniste-dashboard.component';

@Component({
  selector: 'app-workspace-dashboard-route',
  imports: [AdminDashboardComponent, DieteticienDashboardComponent, NutritionnisteDashboardComponent],
  templateUrl: './workspace-dashboard-route.component.html',
})
export class WorkspaceDashboardRouteComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly actorId = toSignal(this.route.parent!.paramMap.pipe(map((params) => params.get('actor') ?? 'admin')),
    { initialValue: this.route.parent?.snapshot.paramMap.get('actor') ?? 'admin' });
  readonly actor = computed(() => this.actorId());
}
