import { HttpErrorResponse } from '@angular/common/http';
import { loginFailure } from './login.component';

describe('loginFailure', () => {
  it('shows the email verification action when the backend requires it', () => {
    const result = loginFailure(new HttpErrorResponse({
      status: 401,
      error: { message: 'Confirmez votre adresse e-mail avec le code reçu avant de vous connecter.' },
    }));

    expect(result.verificationRequired).toBe(true);
    expect(result.message).toContain('Confirmez votre adresse e-mail');
  });

  it('keeps an ordinary invalid password response generic', () => {
    const result = loginFailure(new HttpErrorResponse({
      status: 401,
      error: { message: 'Identifiants invalides.' },
    }));

    expect(result.verificationRequired).toBe(false);
    expect(result.message).toBe('E-mail, téléphone ou mot de passe incorrect.');
  });
});
