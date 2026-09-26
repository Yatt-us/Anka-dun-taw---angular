import { Routes } from '@angular/router';
import { actorWorkspaceGuard } from './core/guards/actor-workspace.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'espaces' },
  {
    path: 'espaces',
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
        path: ':section',
        loadComponent: () =>
          import('./shared/components/workspace-page.component').then(
            (m) => m.WorkspacePageComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'espaces' },
];
