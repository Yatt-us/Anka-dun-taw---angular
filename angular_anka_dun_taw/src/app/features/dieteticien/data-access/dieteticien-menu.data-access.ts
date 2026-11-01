import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, forkJoin, map, Observable, reduce } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

interface ApiPage<T> { content: T[]; number: number; totalPages: number }
export interface Patient { id: number; prenom: string; nom: string; photoProfilUrl?: string | null }
export interface Ingredient { id: number; alimentNom: string; quantite: number; unite: string }
export interface Recipe { id: number; nom: string; nombrePersonnes: number | null; ingredients?: Ingredient[] | null }
export interface PatientProfile { nom: string | null; zone: string | null; objectifId: number | null; budgetActifId: number | null; modeBudget: string | null }
export interface Budget { id: number; montant: number; devise: string; periode: string; actif: boolean }
export interface DailyBudget { montantDisponible: number }
export interface RecipeCost { coutEstime: number; devise: string }
export interface CreatedMenu { id: number }

/** Isole les routes HTTP et la pagination du composant de création de menu. */
@Injectable({ providedIn: 'root' })
export class DieteticienMenuDataAccess {
  private readonly http = inject(HttpClient);

  patients(): Observable<Patient[]> {
    return this.allPages<Patient>('/professionnel/beneficiaires', 'prenom,asc');
  }

  recipes(): Observable<Recipe[]> {
    return this.allPages<Recipe>('/recettes', 'nom,asc');
  }

  patientContext(id: number): Observable<{ profile: PatientProfile; budgets: Budget[] }> {
    const base = `${API_BASE_URL}/professionnel/beneficiaires/${id}`;
    return forkJoin({
      profile: this.http.get<PatientProfile>(`${base}/profil-nutritionnel`),
      budgets: this.allPages<Budget>(`/professionnel/beneficiaires/${id}/budgets`, 'dateDebut,desc'),
    });
  }

  recipe(id: number): Observable<Recipe> {
    return this.http.get<Recipe>(`${API_BASE_URL}/recettes/${id}`);
  }

  dailyBudget(patientId: number, date: string): Observable<DailyBudget> {
    return this.http.get<DailyBudget>(
      `${API_BASE_URL}/professionnel/beneficiaires/${patientId}/petit-budget/jours/${date}`,
    );
  }

  recipeCost(recipeId: number, zone: string, date: string): Observable<RecipeCost | null> {
    return this.http.get<RecipeCost | null>(`${API_BASE_URL}/recettes/${recipeId}/cout-estime`, {
      params: new HttpParams().set('zone', zone).set('date', date),
    });
  }

  create(payload: object): Observable<CreatedMenu> {
    return this.http.post<CreatedMenu>(`${API_BASE_URL}/professionnel/menus`, payload);
  }

  update(id: number, payload: object): Observable<CreatedMenu> {
    return this.http.put<CreatedMenu | null>(`${API_BASE_URL}/professionnel/menus/${id}`, payload)
      .pipe(map((menu) => menu ?? { id }));
  }

  validate(id: number): Observable<CreatedMenu | null> {
    return this.http.post<CreatedMenu | null>(`${API_BASE_URL}/professionnel/menus/${id}/valider`, {});
  }

  publish(id: number): Observable<CreatedMenu | null> {
    return this.http.post<CreatedMenu | null>(`${API_BASE_URL}/professionnel/menus/${id}/publier`, {});
  }

  private allPages<T>(path: string, sort: string): Observable<T[]> {
    const getPage = (page: number) => this.http.get<ApiPage<T>>(`${API_BASE_URL}${path}`, {
      params: new HttpParams().set('page', String(page)).set('size', '100').set('sort', sort),
    });
    return getPage(0).pipe(
      expand((result) => result.number + 1 < result.totalPages ? getPage(result.number + 1) : EMPTY),
      reduce((all, result) => all.concat(result.content), [] as T[]),
    );
  }
}
