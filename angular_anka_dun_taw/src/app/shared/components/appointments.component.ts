import { MatCardModule } from '@angular/material/card';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiIconComponent } from './ui-icon.component';
@Component({
  selector: 'app-appointments',
  imports: [MatCardModule, RouterLink, UiIconComponent],
  template: `<mat-card appearance="outlined" class="panel">
    <div class="panel-heading"><h2>Rendez-vous du jour</h2></div>
    <div class="appointments">
      @for (item of meetings.slice(0, count()); track item.name) {
        <a class="appointment" [routerLink]="destination()"
          ><time>{{ item.time }}</time>
          <div>
            <strong>{{ item.name }}</strong
            ><span
              class="tag"
              [class.orange]="item.tone === 'orange'"
              [class.yellow]="item.tone === 'yellow'"
              >{{ item.reason }}</span
            >
          </div>
          <app-icon name="arrow"
        /></a>
      }
    </div>
  </mat-card>`,
  styleUrl: './dashboard.css',
})
export class AppointmentsComponent {
  readonly count = input(5);
  readonly destination = input('../rendez-vous');
  readonly meetings = [
    { time: '09h00', name: 'Mariam Coulibaly', reason: 'Suivi grossesse', tone: '' },
    { time: '11h30', name: 'Ibrahim Diarra', reason: 'Malnutrition infantile', tone: 'orange' },
    { time: '14h00', name: 'Kadiatou Keita', reason: 'Régime diabétique', tone: '' },
    { time: '15h30', name: 'Oumar Sangaré', reason: 'Perte de poids', tone: 'orange' },
    { time: '17h00', name: 'Aminata Bah', reason: 'Alimentation bébé 6 mois', tone: 'yellow' },
  ];
}
