import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ActorId } from '../../../shared/components/workspace-config';
import { PatientsComponent } from './patients.component';

@Component({
  selector: 'app-professional-patients-route',
  imports: [PatientsComponent],
  template: '<app-patients [actor]="actor()" />',
})
export class ProfessionalPatientsRouteComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly actorId = toSignal(this.route.parent!.paramMap.pipe(map((params) => params.get('actor'))), {
    initialValue: this.route.parent?.snapshot.paramMap.get('actor') ?? null,
  });
  readonly actor = computed<ActorId>(() => this.actorId() === 'nutritionniste' ? 'nutritionniste' : 'dieteticien');
}
