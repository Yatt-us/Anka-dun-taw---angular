import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { API_BASE_URL } from '../../../../core/config/api.config';

interface ApiPage<T> { content: T[]; totalElements: number; totalPages: number }
interface MealCost {
  repasId: number;
  recetteNom: string;
  jour: number;
  typeRepas: string;
  nombrePortions: number;
  dateEstimation: string | null;
  coutRecetteReference: number | null;
  coutParPortion: number | null;
  coutTotalEstime: number | null;
  prixDisponible: boolean;
}
interface MenuCost {
  menuId: number;
  titre: string;
  statut: string;
  zone: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  devise: string;
  coutTotalEstime: number | null;
  prixDisponibles: boolean;
  repas: MealCost[];
}

@Component({
  selector: 'app-portions-couts',
  standalone: true,
  templateUrl: './portions-couts.component.html',
  styleUrl: './portions-couts.component.css',
})
export class PortionsCoutsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly menus = signal<MenuCost[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(0);
  readonly totalMenus = signal(0);
  readonly totalPages = signal(0);
  private readonly pageSize = 10;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new HttpParams().set('page', this.page()).set('size', this.pageSize).set('sort', 'dateDebut,desc');
    this.http.get<ApiPage<MenuCost>>(`${API_BASE_URL}/professionnel/menus/couts-estimes`, { params }).subscribe({
      next: (result) => {
        this.menus.set(result.content);
        this.totalMenus.set(result.totalElements);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: (cause: unknown) => {
        this.error.set(cause instanceof HttpErrorResponse && cause.status === 403
          ? 'Votre compte doit être un diététicien vérifié pour consulter les coûts des menus.'
          : 'Le calcul des coûts est indisponible. Vérifiez votre connexion puis réessayez.');
        this.loading.set(false);
      },
    });
  }

  changePage(delta: number): void {
    this.page.update((current) => Math.max(0, current + delta));
    this.load();
  }

  money(amount: number, currency: string): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} ${currency || 'XOF'}`;
  }

  dateRange(start: string | null, end: string | null): string {
    if (!start) return 'Période non définie';
    if (!end || end === start) return new Date(`${start}T00:00:00`).toLocaleDateString('fr-FR');
    return `${new Date(`${start}T00:00:00`).toLocaleDateString('fr-FR')} – ${new Date(`${end}T00:00:00`).toLocaleDateString('fr-FR')}`;
  }

  label(value: string): string {
    return value.toLocaleLowerCase('fr').replaceAll('_', ' ').replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('fr'));
  }
}
