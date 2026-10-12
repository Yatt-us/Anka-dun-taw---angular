import { Routes } from '@angular/router';
import {
  actorWorkspaceGuard,
  authenticatedGuard,
  workspaceSectionGuard,
} from './core/guards/actor-workspace.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'espaces' },
  {
    path: 'connexion',
    loadComponent: () =>
      import('./features/auth/pages/connexion/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'compte',
    loadComponent: () => import('./features/auth/pages/gestion-compte/account-actions.component').then((m) => m.AccountActionsComponent),
  },
  {
    path: 'espaces',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('./features/auth/pages/workspace-selector.component').then(
        (m) => m.WorkspaceSelectorComponent,
      ),
  },
  {
    path: 'espaces/:actor',
    loadComponent: () =>
      import('./shared/components/workspace-layout.component').then(
        (m) => m.WorkspaceLayoutComponent,
      ),
    canActivate: [actorWorkspaceGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' },
      {
        path: 'tableau-de-bord',
        loadComponent: () =>
          import('./shared/components/workspace-dashboard-route.component').then(
            (m) => m.WorkspaceDashboardRouteComponent,
          ),
      },
      {
        path: 'utilisateurs',
        data: { section: 'utilisateurs' },
        canActivate: [workspaceSectionGuard],
        loadComponent: () =>
          import('./features/admin/pages/gestion-personnes/admin-people-page.component').then(
            (m) => m.AdminPeoplePageComponent,
          ),
      },
      {
        path: 'professionnels',
        data: { section: 'professionnels' },
        canActivate: [workspaceSectionGuard],
        loadComponent: () =>
          import('./features/admin/pages/gestion-personnes/admin-people-page.component').then(
            (m) => m.AdminPeoplePageComponent,
          ),
      },
      {
        path: 'suivi-utilisateurs',
        canActivate: [workspaceSectionGuard],
        loadComponent: () => import('./features/dieteticien/pages/suivi/dieteticien-tracking.component').then((m) => m.DieteticienTrackingComponent),
      },
      {
        path: 'demandes-adaptation',
        canActivate: [workspaceSectionGuard],
        loadComponent: () => import('./features/dieteticien/pages/adaptations/adaptations.component').then((m) => m.AdaptationsComponent),
      },
      {
        path: 'portions-couts',
        canActivate: [workspaceSectionGuard],
        loadComponent: () => import('./features/dieteticien/pages/portions-couts/portions-couts.component').then((m) => m.PortionsCoutsComponent),
      },
      {
        path: 'validation-menus',
        canActivate: [workspaceSectionGuard],
        loadComponent: () => import('./features/dieteticien/pages/validation-menus/validation-menus.component').then((m) => m.ValidationMenusComponent),
      },
      {
        path: 'menus/creer',
        canActivate: [workspaceSectionGuard],
        loadComponent: () => import('./features/dieteticien/pages/creer-menu/dieteticien-create-menu.component').then((m) => m.DieteticienCreateMenuComponent),
      },
      {
        path: 'patients',
        canActivate: [workspaceSectionGuard],
        loadComponent: () => import('./features/professionnel/patients/professional-patients-route.component').then((m) => m.ProfessionalPatientsRouteComponent),
      },
      {
        path: 'parametres',
        canActivate: [workspaceSectionGuard],
        loadComponent: () => import('./features/auth/pages/securite/security.component').then((m) => m.SecurityComponent),
      },
      {
        path: 'disponibilites',
        canActivate: [workspaceSectionGuard],
        loadComponent: () => import('./features/professionnel/disponibilites/disponibilites.component').then((m) => m.DisponibilitesComponent),
      },
      {
        path: 'profil',
        canActivate: [workspaceSectionGuard],
        loadComponent: () => import('./features/professionnel/pages/profil/professional-profile.component').then((m) => m.ProfessionalProfileComponent),
      },
      {
        path: ':section',
        canActivate: [workspaceSectionGuard],
        loadComponent: () =>
          import('./shared/components/workspace-page.component').then(
            (m) => m.WorkspacePageComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'espaces' },
];
