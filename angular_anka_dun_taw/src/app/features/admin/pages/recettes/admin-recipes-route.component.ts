import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DieteticienRecipesComponent } from '../../../dieteticien/pages/recettes/dieteticien-recipes.component';
import { AdminRecipesComponent } from './admin-recipes.component';

@Component({
  selector: 'app-admin-recipes-route',
  imports: [AdminRecipesComponent, DieteticienRecipesComponent],
  template: `@if (isAdmin) { <app-admin-recipes /> } @else { <app-dieteticien-recipes /> }`,
})
export class AdminRecipesRouteComponent {
  private readonly route = inject(ActivatedRoute);
  readonly isAdmin = this.route.parent?.snapshot.paramMap.get('actor') === 'admin';
}
