import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, of, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { AuthService } from '../../../../core/auth/auth.service';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { NutritionnisteProfileOverviewComponent } from '../../../nutritionniste/pages/profil/nutritionniste-profile-overview.component';

export interface ProfessionalProfile {
  id: number; nom: string; prenom: string; email: string | null; telephone: string | null;
  photoProfilUrl: string | null; role: 'DIETETICIEN' | 'NUTRITIONNISTE';
  specialite: string; qualification: string; numeroOrdre: string | null;
  anneesExperience: number | null; biographie: string | null; statutVerification: string;
}
interface IdentityResponse {
  nom: string; prenom: string; telephone: string | null; photoProfilUrl: string | null;
}
interface ProfileForm {
  nom: string; prenom: string; telephone: string; photoProfilUrl: string;
  specialite: string; qualification: string; numeroOrdre: string;
  anneesExperience: number | null; biographie: string;
}

@Component({
  selector: 'app-professional-profile',
  imports: [FormsModule, RouterLink, UiIconComponent, NutritionnisteProfileOverviewComponent],
  templateUrl: './professional-profile.component.html',
  styleUrl: './professional-profile.component.css',
})
export class ProfessionalProfileComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly profile = signal<ProfessionalProfile | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly photoEditorOpen = signal(false);
  readonly editing = signal(false);
  readonly dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());
  form: ProfileForm = this.blankForm();
  private original: ProfileForm = this.blankForm();

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<ProfessionalProfile>(`${API_BASE_URL}/professionnels/me`)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (profile) => { this.applyProfile(profile); this.loading.set(false); },
        error: (cause: unknown) => {
          this.loading.set(false);
          this.error.set(this.describe(cause, 'Impossible de charger votre profil professionnel.'));
        },
      });
  }

  private blankForm(): ProfileForm {
    return { nom: '', prenom: '', telephone: '', photoProfilUrl: '', specialite: '',
      qualification: '', numeroOrdre: '', anneesExperience: null, biographie: '' };
  }
  private fromProfile(profile: ProfessionalProfile): ProfileForm {
    return {
      nom: profile.nom ?? '', prenom: profile.prenom ?? '', telephone: profile.telephone ?? '',
      photoProfilUrl: profile.photoProfilUrl ?? '', specialite: profile.specialite ?? '',
      qualification: profile.qualification ?? '', numeroOrdre: profile.numeroOrdre ?? '',
      anneesExperience: profile.anneesExperience ?? null, biographie: profile.biographie ?? '',
    };
  }
  private applyProfile(profile: ProfessionalProfile): void {
    this.profile.set(profile);
    this.form = this.fromProfile(profile);
    this.original = this.normalized(this.form);
  }
  private normalized(form: ProfileForm): ProfileForm {
    return { ...form, nom: form.nom.trim(), prenom: form.prenom.trim(), telephone: form.telephone.trim(),
      photoProfilUrl: form.photoProfilUrl.trim(), specialite: form.specialite.trim(),
      qualification: form.qualification.trim(), numeroOrdre: form.numeroOrdre.trim(),
      biographie: form.biographie.trim(), anneesExperience: form.anneesExperience == null ? null : Number(form.anneesExperience) };
  }
  dirty(): boolean { return this.profile() !== null &&
    JSON.stringify(this.normalized(this.form)) !== JSON.stringify(this.original); }
  fullName(): string { return [this.form.prenom, this.form.nom].filter(Boolean).join(' ') || 'Mon profil'; }
  specialities(): string[] { return this.form.specialite.split(/[,;]+/).map((part) => part.trim()).filter(Boolean); }

  reset(): void {
    this.form = { ...this.original };
    this.photoEditorOpen.set(false);
    this.error.set('');
    this.success.set('');
  }
  closeEdit(): void { this.reset(); this.editing.set(false); }

  save(ngForm: NgForm): void {
    const profile = this.profile();
    if (!profile || this.saving()) return;
    this.error.set(''); this.success.set('');
    const form = this.normalized(this.form);
    if (ngForm.invalid || !form.nom || !form.prenom || !form.specialite || !form.qualification) {
      ngForm.control.markAllAsTouched();
      this.error.set('Renseignez le nom, le prénom, la spécialité et la qualification.'); return;
    }
    if (!form.telephone && !profile.email) { this.error.set('Un téléphone ou une adresse e-mail doit rester associé au compte.'); return; }
    if (form.photoProfilUrl.length > 500 || !this.validPhotoUrl(form.photoProfilUrl)) {
      this.error.set('Utilisez une adresse de photo HTTP(S) valide ou un chemin de cette application.'); return;
    }
    if (form.anneesExperience !== null && (!Number.isInteger(form.anneesExperience) || form.anneesExperience < 0 || form.anneesExperience > 80)) {
      this.error.set('Les années d’expérience doivent être comprises entre 0 et 80.'); return;
    }
    const identityChanged = ['nom', 'prenom', 'telephone', 'photoProfilUrl'].some((key) =>
      form[key as keyof ProfileForm] !== this.original[key as keyof ProfileForm]);
    const professionalChanged = ['specialite', 'qualification', 'numeroOrdre', 'anneesExperience', 'biographie'].some((key) =>
      form[key as keyof ProfileForm] !== this.original[key as keyof ProfileForm]);
    if (!identityChanged && !professionalChanged) { this.success.set('Aucune modification à enregistrer.'); return; }
    this.saving.set(true);
    let identitySaved = false;
    let savedIdentity: IdentityResponse | null = null;
    const personalUpdate: Observable<IdentityResponse | null> = identityChanged
      ? this.http.put<IdentityResponse>(`${API_BASE_URL}/me`, {
          nom: form.nom, prenom: form.prenom, telephone: form.telephone,
          photoProfilUrl: form.photoProfilUrl || null,
        }).pipe(tap((response) => { identitySaved = true; savedIdentity = response; }))
      : of(null);
    const professionalUpdate = (): Observable<ProfessionalProfile | null> => professionalChanged
      ? this.http.put<ProfessionalProfile>(`${API_BASE_URL}/professionnels/me`, {
          specialite: form.specialite, qualification: form.qualification,
          numeroOrdre: form.numeroOrdre || null,
          anneesExperience: form.anneesExperience, biographie: form.biographie || null,
        })
      : of(null);
    personalUpdate.pipe(
      switchMap(() => professionalUpdate()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (updatedProfile) => {
        this.saving.set(false);
        const saved = updatedProfile ?? { ...profile, ...(savedIdentity ?? {
          nom: form.nom, prenom: form.prenom, telephone: form.telephone,
          photoProfilUrl: form.photoProfilUrl || null,
        }) };
        this.applyProfile(saved);
        this.success.set('Profil enregistré.');
        if (saved.role === 'NUTRITIONNISTE') this.editing.set(false);
        if (identityChanged) this.refreshIdentity();
      },
      error: (cause: unknown) => {
        this.saving.set(false);
        if (identitySaved) {
          const saved = savedIdentity ?? { nom: form.nom, prenom: form.prenom,
            telephone: form.telephone, photoProfilUrl: form.photoProfilUrl || null };
          this.original = { ...this.original, nom: saved.nom, prenom: saved.prenom,
            telephone: saved.telephone ?? '', photoProfilUrl: saved.photoProfilUrl ?? '' };
          this.form = { ...this.form, nom: saved.nom, prenom: saved.prenom,
            telephone: saved.telephone ?? '', photoProfilUrl: saved.photoProfilUrl ?? '' };
          this.profile.update((current) => current ? { ...current, ...saved } : current);
          this.success.set('Nom, téléphone ou photo enregistrés.');
          this.refreshIdentity();
        }
        this.error.set(this.describe(cause, identitySaved || !identityChanged
          ? 'Enregistrement des informations professionnelles impossible.'
          : 'Enregistrement des informations personnelles impossible.'));
      },
    });
  }

  roleLabel(role: string): string { return role === 'NUTRITIONNISTE' ? 'Nutritionniste' : 'Diététicien(ne)'; }
  verificationLabel(status: string): string {
    return ({ VERIFIE: 'Profil vérifié', EN_ATTENTE: 'Vérification en attente', REFUSE: 'Vérification refusée', SUSPENDU: 'Profil suspendu' } as Record<string, string>)[status] ?? status;
  }
  initials(): string { return [this.form.prenom?.[0], this.form.nom?.[0]].filter(Boolean).join('').toLocaleUpperCase('fr') || 'P'; }
  hideBrokenImage(event: Event): void { (event.target as HTMLImageElement).remove(); }
  private validPhotoUrl(value: string): boolean {
    if (!value) return true;
    if (!/^https?:\/\//i.test(value) && !/^\/(?!\/)/.test(value)) return false;
    try { return ['http:', 'https:'].includes(new URL(value, 'https://anka.invalid').protocol); }
    catch { return false; }
  }
  private refreshIdentity(): void {
    this.auth.refreshSession().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
  }
  private describe(cause: unknown, fallback: string): string {
    return cause instanceof HttpErrorResponse && typeof cause.error?.message === 'string' ? cause.error.message : fallback;
  }
}
