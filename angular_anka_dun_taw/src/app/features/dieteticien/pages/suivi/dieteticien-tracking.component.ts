import { MatCardModule } from '@angular/material/card';
import { Component } from '@angular/core';
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
export class DieteticienTrackingComponent {
  readonly metrics = [
    {
      label: 'Taux d’adhérence global',
      value: '88,4 %',
      detail: 'Menus respectés à Bamako',
      tone: '',
    },
    {
      label: 'Respect du budget',
      value: '92,1 %',
      detail: 'Dans la limite des FCFA prescrits',
      tone: 'yellow',
    },
    {
      label: 'Retours d’habitudes',
      value: '4,8 / 5',
      detail: 'Note d’appréciation locale',
      tone: 'orange',
    },
    {
      label: 'Suivis nutritionnels OK',
      value: '118 / 142',
      detail: 'Objectifs atteints',
      tone: '',
    },
  ];
  readonly cereals = [
    { name: 'Mil traditionnel (bouillies & tô)', value: 45, color: 'var(--green)' },
    { name: 'Fonio précuit (salades & vapeur)', value: 28, color: 'var(--yellow)' },
    { name: 'Riz blanc local (riz au gras)', value: 18, color: 'var(--orange)' },
    { name: 'Sorgho & maïs blanc', value: 9, color: '#59746a' },
  ];
  readonly patients = [
    {
      name: 'Fatoumata Diarra',
      initials: 'FD',
      goal: 'Fer + nutrition bébé',
      adherence: 94,
      budget: '8 400',
      note: 'En forte hausse',
      color: 'var(--green)',
    },
    {
      name: 'Moussa Keita',
      initials: 'MK',
      goal: 'Régulation glycémique',
      adherence: 81,
      budget: '10 500',
      note: 'Stable',
      color: 'var(--yellow)',
    },
    {
      name: 'Oumar Sangaré',
      initials: 'OS',
      goal: 'Réduction du sodium',
      adherence: 73,
      budget: '14 000',
      note: 'En légère baisse (sel au marché)',
      color: 'var(--orange)',
    },
    {
      name: 'Awa Sidibé',
      initials: 'AS',
      goal: 'Diversification 12 mois',
      adherence: 98,
      budget: '5 600',
      note: 'Excellent (bouillies validées)',
      color: 'var(--green)',
    },
  ];
}
