import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SecurityComponent } from '../../../auth/pages/securite/security.component';
import { AdminSettingsComponent } from './admin-settings.component';

@Component({
  selector: 'app-admin-settings-route',
  imports: [AdminSettingsComponent, SecurityComponent],
  template: `@if (isAdmin) { <app-admin-settings /> } @else { <app-security /> }`,
})
export class AdminSettingsRouteComponent {
  private readonly route = inject(ActivatedRoute);
  readonly isAdmin = this.route.parent?.snapshot.paramMap.get('actor') === 'admin';
}
