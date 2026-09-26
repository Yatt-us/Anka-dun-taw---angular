import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { isActorId } from '../../shared/components/workspace-config';

export const actorWorkspaceGuard: CanActivateFn = (route) =>
  isActorId(route.paramMap.get('actor')) || inject(Router).parseUrl('/espaces');
