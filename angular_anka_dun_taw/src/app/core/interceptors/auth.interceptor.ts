import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from '../config/api.config';

const AUTH_RETRIED = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(`${API_BASE_URL}/`)) {
    return next(request);
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const isLogin = request.url === `${API_BASE_URL}/auth/connexion`;
  const isRefresh = request.url === `${API_BASE_URL}/auth/rafraichir`;
  const isLogout = request.url === `${API_BASE_URL}/auth/deconnexion`;
  const tokenAtStart = auth.getAccessToken();
  const apiRequest = request.clone({
    withCredentials: true,
    ...(tokenAtStart && !isLogin && !isRefresh
      ? { setHeaders: { Authorization: `Bearer ${tokenAtStart}` } }
      : {}),
  });
  const handleProfessionalForbidden = (error: HttpErrorResponse) => {
    if (error.status === 403 && error.error?.message === 'Profil professionnel non vérifié.') {
      auth.noteUnverifiedProfessional();
      void router.navigateByUrl('/espaces');
    }
  };
  const redirectToLogin = () => {
    auth.clearSession();
    if (!router.url.startsWith('/connexion')) {
      void router.navigate(['/connexion'], { queryParams: { retour: router.url } });
    }
  };

  return next(apiRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      handleProfessionalForbidden(error);
      if (
        error.status !== 401 ||
        isLogin ||
        isRefresh ||
        isLogout ||
        request.context.get(AUTH_RETRIED)
      ) {
        return throwError(() => error);
      }

      const currentToken = auth.getAccessToken();
      const token$ =
        currentToken && currentToken !== tokenAtStart
          ? of(currentToken)
          : auth.refreshSession().pipe(
              map(() => auth.getAccessToken()),
              catchError((refreshError: unknown) => {
                redirectToLogin();
                return throwError(() => refreshError);
              }),
            );

      return token$.pipe(
        switchMap((token) => {
          if (!token) {
            return throwError(() => error);
          }
          return next(
            request.clone({
              withCredentials: true,
              setHeaders: { Authorization: `Bearer ${token}` },
              context: request.context.set(AUTH_RETRIED, true),
            }),
          ).pipe(
            catchError((retryError: unknown) => {
              if (retryError instanceof HttpErrorResponse) {
                handleProfessionalForbidden(retryError);
                if (retryError.status === 401) {
                  redirectToLogin();
                }
              }
              return throwError(() => retryError);
            }),
          );
        }),
      );
    }),
  );
};
