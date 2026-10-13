import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { WorkspacePageComponent } from '../../../../shared/components/workspace-page.component';
import { NutritionnisteAppointmentsComponent } from './nutritionniste-appointments.component';

@Component({
  selector: 'app-nutritionniste-appointments-route',
  imports: [WorkspacePageComponent, NutritionnisteAppointmentsComponent],
  template: `@if (isNutritionist) { <app-nutritionniste-appointments /> } @else { <app-workspace-page /> }`,
})
export class NutritionnisteAppointmentsRouteComponent {
  private readonly route = inject(ActivatedRoute);
  readonly isNutritionist = this.route.parent?.snapshot.paramMap.get('actor') === 'nutritionniste';
}
