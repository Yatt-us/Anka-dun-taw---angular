import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ActorId } from '../../../shared/components/workspace-config';

interface ApiPage<T> { content: T[]; totalElements: number }
interface PatientSummary { id: number; nom: string; prenom: string }
interface Patient { id: number; name: string }
interface NutritionProfile { zone?: string; poidsKg?: number; tailleCm?: number; imc?: number; niveauActivite?: string; modeBudget?: string; allergies?: string[]; commentaireSante?: string }
interface Goal { id: number; description?: string; type?: string; statut?: string; progressionPourcentage?: number }
interface Budget { id: number; montant: number; devise?: string; periode?: string; actif?: boolean }
interface DailyBudget { date: string; montantDisponible: number; plafond: number; devise?: string }

@Component({
  selector: 'app-patients',
  imports: [FormsModule, A11yModule],
  templateUrl: './patients.component.html',
  styleUrl: './patients.component.css',
})
export class PatientsComponent {
  private readonly http = inject(HttpClient);
  readonly actor = input.required<ActorId>();
  readonly patients = signal<Patient[]>([]);
  readonly selected = signal<Patient | null>(null);
  readonly profile = signal<NutritionProfile | null>(null);
  readonly goals = signal<Goal[]>([]);
  readonly budgets = signal<Budget[]>([]);
  readonly dailyBudget = signal<DailyBudget | null>(null);
  readonly loading = signal(false);
  readonly patientPage = signal(0);
  readonly patientTotal = signal(0);
  readonly patientPageSize = 12;
  readonly detailLoading = signal(false);
  readonly error = signal('');
  readonly detailError = signal('');
  searchedId: number | null = null;
  selectedDate = new Date().toISOString().slice(0, 10);

  constructor() { effect(() => { this.actor(); this.load(); }); }
  selectById(): void {
    const id = this.searchedId;
    if (id !== null && Number.isInteger(id) && id > 0) this.select({ id, name: `Patient n° ${id}` });
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new HttpParams().set('page', this.patientPage()).set('size', this.patientPageSize);
    this.http.get<ApiPage<PatientSummary>>(`${API_BASE_URL}/professionnel/beneficiaires`, { params }).subscribe({
      next: (page) => {
        this.patients.set(page.content.map((item) => ({ id: item.id, name: [item.prenom, item.nom].filter(Boolean).join(' ') || `Patient n° ${item.id}` })));
        this.patientTotal.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => { this.error.set('Chargement des patients liés impossible. Réessayez.'); this.loading.set(false); },
    });
  }
  changePatientPage(delta: number): void { this.patientPage.update((page) => Math.max(0, page + delta)); this.load(); }
  select(patient: Patient): void {
    this.selected.set(patient); this.profile.set(null); this.goals.set([]); this.budgets.set([]); this.dailyBudget.set(null); this.detailError.set('');
    this.detailLoading.set(true);
    const base = `${API_BASE_URL}/professionnel/beneficiaires/${patient.id}`;
    forkJoin({
      profile: this.http.get<NutritionProfile>(`${base}/profil-nutritionnel`),
      goals: this.http.get<Goal[]>(`${base}/objectifs`),
      budgets: this.http.get<ApiPage<Budget>>(`${base}/budgets`),
    }).subscribe({
      next: (data) => { this.profile.set(data.profile); this.goals.set(data.goals); this.budgets.set(data.budgets.content); this.detailLoading.set(false); },
      error: (error: unknown) => { this.detailError.set(error instanceof HttpErrorResponse && error.status === 403 ? 'Vous n’avez pas accès à ce dossier.' : 'Ce dossier est incomplet ou inaccessible.'); this.detailLoading.set(false); },
    });
  }
  loadDay(id: number): void {
    this.dailyBudget.set(null);
    this.http.get<DailyBudget>(`${API_BASE_URL}/professionnel/beneficiaires/${id}/petit-budget/jours/${this.selectedDate}`).subscribe({
      next: (budget) => this.dailyBudget.set(budget),
      error: () => this.detailError.set('Aucun budget petit montant disponible pour cette date.'),
    });
  }
  closeDetail(): void { this.selected.set(null); }
}
