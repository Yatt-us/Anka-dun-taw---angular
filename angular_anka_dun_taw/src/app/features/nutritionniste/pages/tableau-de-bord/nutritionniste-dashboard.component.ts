import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { AppointmentsComponent } from '../../../../shared/components/appointments.component';
@Component({
  selector: 'app-nutritionniste-dashboard',
  imports: [MatCardModule, MatButtonModule, RouterLink, UiIconComponent, AppointmentsComponent],
  templateUrl: './nutritionniste-dashboard.component.html',
  styleUrl: '../../../../shared/components/dashboard.css',
})
export class NutritionnisteDashboardComponent {
  readonly metrics = [
    { label: 'Questions en attente', value: '8 Messages', icon: 'mail', tone: '' },
    { label: 'Demandes de consultation', value: '3 Nouvelles', icon: 'book', tone: 'orange' },
    { label: 'Rendez-vous aujourd’hui', value: '5 Sessions', icon: 'calendar', tone: 'yellow' },
  ];
  readonly questions = [
    {
      name: 'Fatoumata D.',
      initials: 'FD',
      time: 'il y a 2h',
      title: 'Mon enfant de 2 ans refuse le tô, que faire ?',
      text: 'Il refuse systématiquement le tô de mil traditionnel. Comment puis-je l’accompagner ?',
    },
    {
      name: 'Moussa K.',
      initials: 'MK',
      time: 'il y a 5h',
      title: 'Quels aliments riches en fer pour une femme enceinte ?',
      text: 'Ma femme est à son deuxième trimestre et nous aimerions des conseils.',
    },
    {
      name: 'Awa S.',
      initials: 'AS',
      time: 'hier',
      title: 'Le fonio est-il bon pour les diabétiques ?',
      text: 'Mon père a récemment été diagnostiqué avec un diabète de type 2.',
    },
  ];
}
