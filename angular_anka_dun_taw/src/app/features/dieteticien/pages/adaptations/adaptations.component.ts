import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { API_BASE_URL } from '../../../../core/config/api.config';

interface ApiPage<T> { content: T[]; totalElements: number }
interface Meal { recetteId: number; jour: number; typeRepas: string; nombrePortions: number; commentaire?: string }
interface Menu { id: number; titre: string; description?: string; type: string; dateDebut: string; dateFin?: string; recommandations?: string; zone?: string; repas: Meal[] }
interface Request { id: number; demandeurId: number; motif: string; statut: string; reponse?: string; menuReviseId?: number }
interface Recipe { id: number; nom: string }

@Component({
  selector: 'app-adaptations',
  imports: [FormsModule, A11yModule],
  templateUrl: './adaptations.component.html',
  styleUrl: './adaptations.component.css',
})
export class AdaptationsComponent {
  private readonly http = inject(HttpClient);
  readonly menus = signal<Menu[]>([]);
  readonly recipes = signal<Recipe[]>([]);
  readonly requests = signal<Request[]>([]);
  readonly selectedMenu = signal<Menu | null>(null);
  readonly selectedRequest = signal<Request | null>(null);
  readonly decision = signal<'accept' | 'refuse'>('refuse');
  readonly menuPage = signal(0); readonly menuTotal = signal(0);
  readonly requestPage = signal(0); readonly requestTotal = signal(0);
  readonly loadingMenus = signal(false); readonly loadingRequests = signal(false); readonly saving = signal(false);
  readonly error = signal(''); readonly success = signal('');
  response = ''; revisionTitle = ''; revisionStart = ''; revisionEnd = ''; revisionNotes = '';
  revisionMeals: Meal[] = [];

  constructor() { this.loadMenus(); this.http.get<ApiPage<Recipe>>(`${API_BASE_URL}/recettes`, { params: new HttpParams().set('size', 200) }).subscribe({ next: (page) => this.recipes.set(page.content) }); }
  loadMenus(): void {
    this.loadingMenus.set(true);
    this.http.get<ApiPage<Menu>>(`${API_BASE_URL}/professionnel/menus`, { params: new HttpParams().set('page', this.menuPage()).set('size', 20) }).subscribe({
      next: (page) => { this.menus.set(page.content); this.menuTotal.set(page.totalElements); this.loadingMenus.set(false); },
      error: (error: unknown) => { this.error.set(this.describe(error)); this.loadingMenus.set(false); },
    });
  }
  selectMenu(menu: Menu): void { this.selectedMenu.set(menu); this.selectedRequest.set(null); this.requestPage.set(0); this.loadRequests(); }
  loadRequests(): void {
    const menu = this.selectedMenu(); if (!menu) return;
    this.loadingRequests.set(true);
    this.http.get<ApiPage<Request>>(`${API_BASE_URL}/professionnel/menus/${menu.id}/demandes-adaptation`, {
      params: new HttpParams().set('page', this.requestPage()).set('size', 20),
    }).subscribe({ next: (page) => { this.requests.set(page.content); this.requestTotal.set(page.totalElements); this.loadingRequests.set(false); },
      error: (error: unknown) => { this.error.set(this.describe(error)); this.loadingRequests.set(false); } });
  }
  changeMenuPage(delta: number): void { this.menuPage.update((page) => page + delta); this.selectedMenu.set(null); this.requests.set([]); this.loadMenus(); }
  changeRequestPage(delta: number): void { this.requestPage.update((page) => page + delta); this.loadRequests(); }
  recipeListed(id: number): boolean { return this.recipes().some((recipe) => recipe.id === id); }
  choose(request: Request, decision: 'accept' | 'refuse'): void {
    const menu = this.selectedMenu(); if (!menu) return;
    this.selectedRequest.set(request); this.decision.set(decision); this.error.set(''); this.success.set(''); this.response = '';
    this.revisionTitle = `${menu.titre} — adapté`; this.revisionStart = menu.dateDebut;
    this.revisionEnd = menu.dateFin ?? ''; this.revisionNotes = menu.recommandations ?? '';
    this.revisionMeals = menu.repas.map((meal) => ({ recetteId: meal.recetteId, jour: meal.jour, typeRepas: meal.typeRepas, nombrePortions: meal.nombrePortions, commentaire: meal.commentaire }));
  }
  closeDecision(): void { if (!this.saving()) this.selectedRequest.set(null); }
  submit(): void {
    const request = this.selectedRequest(), menu = this.selectedMenu(); if (!request || !menu || this.saving()) return;
    if (!this.response.trim()) { this.error.set('Une réponse au patient est obligatoire.'); return; }
    const accepte = this.decision() === 'accept';
    if (accepte && (!this.revisionTitle.trim() || !this.revisionStart || !this.revisionMeals.length ||
      this.revisionMeals.some((meal) => !meal.recetteId || meal.jour < 1 || meal.nombrePortions <= 0))) {
      this.error.set('Complétez le menu révisé et tous ses repas.'); return;
    }
    const body = accepte ? { acceptee: true, reponse: this.response.trim(), menuRevise: {
      titre: this.revisionTitle.trim(), description: menu.description, type: menu.type,
      dateDebut: this.revisionStart, dateFin: this.revisionEnd || null,
      recommandations: this.revisionNotes, zone: menu.zone, beneficiaireIds: [request.demandeurId],
      repas: this.revisionMeals,
    } } : { acceptee: false, reponse: this.response.trim() };
    this.saving.set(true); this.error.set('');
    this.http.post(`${API_BASE_URL}/professionnel/menus/demandes-adaptation/${request.id}/traiter`, body).subscribe({
      next: () => { this.saving.set(false); this.selectedRequest.set(null); this.success.set(accepte ? 'Menu révisé créé. Validez puis publiez-le dans « Menus ».' : 'Demande refusée et réponse envoyée.'); this.loadRequests(); },
      error: (error: unknown) => { this.saving.set(false); this.error.set(this.describe(error)); },
    });
  }
  private describe(error: unknown): string { return error instanceof HttpErrorResponse && typeof error.error?.message === 'string' ? error.error.message : 'Cette opération a échoué.'; }
}
