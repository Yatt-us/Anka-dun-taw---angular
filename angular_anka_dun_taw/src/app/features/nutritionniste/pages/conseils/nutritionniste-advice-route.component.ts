import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DieteticienRecommendationsComponent } from '../../../dieteticien/pages/recommandations/dieteticien-recommendations.component';
import { NutritionnisteAdviceComponent } from './nutritionniste-advice.component';

@Component({
  selector: 'app-nutritionniste-advice-route',
  imports: [DieteticienRecommendationsComponent, NutritionnisteAdviceComponent],
  template: `@if (isNutritionist) { <app-nutritionniste-advice /> } @else { <app-dieteticien-recommendations /> }`,
})
export class NutritionnisteAdviceRouteComponent {
  private readonly route = inject(ActivatedRoute);
  readonly isNutritionist = this.route.parent?.snapshot.paramMap.get('actor') === 'nutritionniste';
}
