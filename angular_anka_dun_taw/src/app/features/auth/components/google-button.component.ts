import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, EventEmitter, NgZone, Output, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { API_BASE_URL } from '../../../core/config/api.config';

interface GoogleIdentityApi {
  accounts: { id: {
    initialize(options: { client_id: string; callback: (response: { credential?: string }) => void }): void;
    renderButton(element: HTMLElement, options: { theme: string; size: string; text: string; locale: string }): void;
  } };
}

interface GoogleConfiguration { disponible: boolean; clientId: string | null }

let scriptLoading: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if ((window as Window & { google?: GoogleIdentityApi }).google) return Promise.resolve();
  if (!scriptLoading) {
    scriptLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client?hl=fr';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { scriptLoading = null; reject(new Error('Google indisponible')); };
      document.head.appendChild(script);
    });
  }
  return scriptLoading;
}

@Component({
  selector: 'app-google-button',
  templateUrl: './google-button.component.html',
  styleUrl: './google-button.component.css',
})
export class GoogleButtonComponent implements AfterViewInit {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('button') private button?: ElementRef<HTMLElement>;
  @Output() readonly credential = new EventEmitter<string>();
  readonly available = signal(false);
  readonly error = signal('');
  readonly information = signal('');

  ngAfterViewInit(): void {
    this.http.get<GoogleConfiguration>(`${API_BASE_URL}/auth/google/configuration`)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (config) => {
        if (!config.disponible || !config.clientId) {
          this.information.set('La connexion Google n’est pas configurée pour cette application.');
          return;
        }
        this.available.set(true);
        setTimeout(() => this.render(config.clientId!), 0);
      },
      error: () => this.information.set('La connexion Google est momentanément indisponible. Utilisez votre e-mail ou téléphone.'),
    });
  }

  private async render(clientId: string): Promise<void> {
    try {
      await loadGoogleScript();
      const google = (window as Window & { google?: GoogleIdentityApi }).google;
      const element = this.button?.nativeElement;
      if (!google || !element) throw new Error('Google indisponible');
      google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          if (credential) this.zone.run(() => this.credential.emit(credential));
        },
      });
      google.accounts.id.renderButton(element, {
        theme: 'outline', size: 'large', text: 'continue_with', locale: 'fr',
      });
    } catch {
      this.zone.run(() => {
        this.available.set(false);
        this.error.set('Le bouton Google n’a pas pu être chargé. Utilisez votre e-mail ou téléphone.');
      });
    }
  }
}
