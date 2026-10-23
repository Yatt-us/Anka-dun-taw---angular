import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { AuthenticatedUser, UserRole } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { ACTORS, ActorId, isActorId } from '../../shared/components/workspace-config';

export function actorForRole(role: UserRole): ActorId | null {
  switch (role) {
    case 'ADMIN':
      return 'admin';
    case 'DIETETICIEN':
      return 'dieteticien';
    case 'NUTRITIONNISTE':
      return 'nutritionniste';
    default:
      return null;
  }
}

function authorizedActor(
  user: AuthenticatedUser,
  auth: AuthService,
  router: Router,
): Observable<ActorId | UrlTree> {
  const actor = actorForRole(user.role);
  if (actor) {
    return of(actor);
  }
  return auth.logout().pipe(
    map(() => router.parseUrl('/connexion?acces=refuse')),
    catchError(() => of(router.parseUrl('/connexion?acces=refuse&deconnexion=echec'))),
  );
}

export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(
    switchMap((user) => {
      if (!user) {
        return of(router.createUrlTree(['/connexion'], { queryParams: { retour: state.url } }));
      }
      return authorizedActor(user, auth, router).pipe(
        switchMap((actor) => {
          if (actor instanceof UrlTree) {
            return of(actor);
          }
          return actor === 'admin'
            ? of(true)
            : auth.checkProfessionalStatus().pipe(map(() => true));
        }),
      );
    }),
  );
};

export const actorWorkspaceGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const target = route.paramMap.get('actor');
  if (!isActorId(target)) {
    return router.parseUrl('/espaces');
  }
  return auth.ensureSession().pipe(
    switchMap((user) => {
      if (!user) {
        return of(router.createUrlTree(['/connexion'], { queryParams: { retour: state.url } }));
      }
      return authorizedActor(user, auth, router).pipe(
        switchMap((actor) => {
          if (actor instanceof UrlTree) {
            return of(actor);
          }
          if (actor !== target) {
            return of(router.createUrlTree(['/espaces', actor, 'tableau-de-bord']));
          }
          if (actor === 'admin') {
            return of(true);
          }
          return auth
            .checkProfessionalStatus()
            .pipe(map((status) => (status === 'VERIFIE' ? true : router.parseUrl('/espaces'))));
        }),
      );
    }),
  );
};

/**
 * A signed-in actor must not be able to open a workspace section that is not
 * part of that actor's navigation. The parent actor guard continues to check
 * the authenticated role and professional verification status.
 */
export const workspaceSectionGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const actorId = route.parent?.paramMap.get('actor') ?? null;
  const section = route.paramMap.get('section') ?? route.routeConfig?.path ?? null;

  if (!isActorId(actorId) || !section) {
    return router.parseUrl('/espaces');
  }

  const isAllowed = ACTORS[actorId].navigation.some((item) =>
    item.path === section || item.children?.some((child) => child.path === section),
  );
  return isAllowed ? true : router.parseUrl(`/espaces/${actorId}/tableau-de-bord`);
};
