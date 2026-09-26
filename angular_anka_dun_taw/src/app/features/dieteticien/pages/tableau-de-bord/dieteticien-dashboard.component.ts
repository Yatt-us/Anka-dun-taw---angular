import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { AppointmentsComponent } from '../../../../shared/components/appointments.component';
@Component({
  selector: 'app-dieteticien-dashboard',
  imports: [MatCardModule, MatButtonModule, RouterLink, UiIconComponent, AppointmentsComponent],
  templateUrl: './dieteticien-dashboard.component.html',
  styleUrl: '../../../../shared/components/dashboard.css',
})
export class DieteticienDashboardComponent {
  readonly ignored = signal(false);
  readonly metrics = [
    {
      label: 'Mes patients actifs',
      value: '142 Patients',
      detail: '+8 % ce mois-ci',
      icon: 'users',
      tone: '',
    },
    {
      label: 'Menus à créer ou valider',
      value: '12 Menus',
      detail: '4 en attente urgente',
      icon: 'book',
      tone: 'orange',
    },
    {
      label: 'Demandes d’adaptation',
      value: '5 Nouvelles',
      detail: 'Temps de réponse moyen : 4h',
      icon: 'refresh',
      tone: 'yellow',
    },
    {
      label: 'Taux de réussite',
      value: '94,2 %',
      detail: 'Objectifs nutritionnels atteints',
      icon: 'chart',
      tone: '',
    },
  ];
}
