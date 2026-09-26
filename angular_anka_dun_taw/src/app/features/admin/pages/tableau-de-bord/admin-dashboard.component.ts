import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { RegistrationChartComponent } from '../../../../shared/components/charts/registration-chart.component';
import { UserDistributionChartComponent } from '../../../../shared/components/charts/user-distribution-chart.component';
@Component({
  selector: 'app-admin-dashboard',
  imports: [
    MatCardModule,
    MatButtonModule,
    RouterLink,
    UiIconComponent,
    RegistrationChartComponent,
    UserDistributionChartComponent,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['../../../../shared/components/dashboard.css', './admin-dashboard.component.css'],
})
export class AdminDashboardComponent {
  readonly metrics = [
    {
      label: 'Utilisateurs actifs',
      value: '1 247',
      detail: '+12 % ce mois',
      icon: 'users',
      tone: '',
    },
    {
      label: 'Professionnels vérifiés',
      value: '38',
      detail: '+2 cette semaine',
      icon: 'pro',
      tone: '',
    },
    {
      label: 'Aliments référencés',
      value: '312',
      detail: 'Fonio, mil, tamarin…',
      icon: 'leaf',
      tone: '',
    },
    {
      label: 'Recettes publiées',
      value: '89',
      detail: '8 nouvelles',
      icon: 'book',
      tone: 'orange',
    },
    {
      label: 'Menus actifs',
      value: '156',
      detail: 'Plans hebdomadaires',
      icon: 'calendar',
      tone: '',
    },
    {
      label: 'Contenus éducatifs',
      value: '45',
      detail: 'Fiches & conseils',
      icon: 'book',
      tone: 'yellow',
    },
  ];
  readonly activities = [
    {
      name: 'Oumar Koné',
      action: 'Recette ajoutée aux favoris (Saga-Saga)',
      role: 'Parent',
      time: 'Il y a 5 min',
    },
    {
      name: 'Dr. Alassane Keita',
      action: 'Demande de vérification de profil',
      role: 'Pro',
      time: 'Il y a 14 min',
    },
    {
      name: 'Aminata Soucko',
      action: 'Profil créé avec succès',
      role: 'Parent',
      time: 'Il y a 45 min',
    },
  ];
}
