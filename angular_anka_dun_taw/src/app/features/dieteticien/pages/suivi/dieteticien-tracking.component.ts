import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';

@Component({
  selector: 'app-dieteticien-tracking',
  imports: [MatCardModule, UiIconComponent],
  templateUrl: './dieteticien-tracking.component.html',
  styleUrls: [
    '../../../../shared/components/dashboard.css',
    './dieteticien-tracking.component.css',
  ],
})
export class DieteticienTrackingComponent {}
