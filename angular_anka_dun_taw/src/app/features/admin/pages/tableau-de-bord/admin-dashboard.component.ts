import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import { ACTORS } from '../../../../shared/components/workspace-config';
import { formatStatusLabel } from '../../../../shared/utils/workspace-formatters';
import { catchError, of, Subject, switchMap, timer } from 'rxjs';
import {
  ActivityReport,
  AdminDashboardApi,
  AdminSearchResult,
  AdminStatistics,
  JournalActivity,
} from '../../data-access/admin-dashboard.data-access';

interface MonthBar {
  key: string;
  label: string;
  value: number;
  height: number;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [DatePipe, MatCardModule, MatButtonModule, RouterLink, UiIconComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['../../../../shared/components/dashboard.css', './admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit {
  private readonly api = inject(AdminDashboardApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly numberFormat = new Intl.NumberFormat('fr-FR');
  private readonly searchInput = new Subject<string>();

  readonly statistics = signal<AdminStatistics | null>(null);
  readonly statisticsError = signal(false);
  readonly reportError = signal(false);
  readonly activitiesError = signal(false);
  readonly months = signal<MonthBar[] | null>(null);
  readonly activities = signal<JournalActivity[] | null>(null);
  readonly createdMenus = signal<number | null>(null);
  readonly educationalContent = signal<number | null>(null);
  readonly searchQuery = signal('');
  readonly searchResults = signal<AdminSearchResult[]>([]);
  readonly searchLoading = signal(false);
  readonly searchError = signal(false);
  readonly sectionResults = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('fr');
    if (!query) return [];
    return ACTORS.admin.navigation.filter((item) =>
      item.label.toLocaleLowerCase('fr').includes(query),
    ).slice(0, 6);
  });
  readonly hasRegistrations = computed(
    () => this.months()?.some((month) => month.value > 0) ?? false,
  );

  readonly metrics = computed(() => {
    const statistics = this.statistics();
    const value = (count: number | null | undefined, failed = this.statisticsError()) =>
      count == null ? (failed ? '—' : '…') : this.numberFormat.format(count);
    const detail = this.statisticsError() ? 'Données indisponibles' : '';
    return [
      {
        label: 'Utilisateurs actifs',
        value: value(statistics?.utilisateursActifs),
        detail,
        icon: 'users',
        tone: '',
      },
      {
        label: 'Professionnels vérifiés',
        value: value(
          statistics ? statistics.dieteticiensActifs + statistics.nutritionnistesActifs : undefined,
        ),
        detail: statistics ? 'Diététiciens et nutritionnistes actifs' : detail,
        icon: 'pro',
        tone: 'orange',
      },
      {
        label: 'Aliments locaux disponibles',
        value: value(statistics?.alimentsLocauxDisponibles),
        detail: statistics ? 'Disponibles dans le catalogue local' : detail,
        icon: 'leaf',
        tone: 'green',
      },
      {
        label: 'Recettes publiées',
        value: value(statistics?.recettesPubliees),
        detail,
        icon: 'book',
        tone: 'orange',
      },
      {
        label: 'Menus créés',
        value: value(this.createdMenus(), this.createdMenusError()),
        detail: this.createdMenusError() ? 'Données indisponibles' : '',
        icon: 'grid',
        tone: 'blue',
      },
      {
        label: 'Contenus éducatifs',
        value: value(this.educationalContent(), this.educationalContentError()),
        detail: this.educationalContentError() ? 'Données indisponibles' : '',
        icon: 'book',
        tone: 'yellow',
      },
    ];
  });
  readonly createdMenusError = signal(false);
  readonly educationalContentError = signal(false);

  readonly distribution = computed(() => {
    const statistics = this.statistics();
    if (!statistics) return null;
    const users = statistics.utilisateursActifs;
    const professionals = statistics.dieteticiensActifs + statistics.nutritionnistesActifs;
    const total = users + professionals;
    return {
      users: this.numberFormat.format(users),
      professionals: this.numberFormat.format(professionals),
      total: this.numberFormat.format(total),
      rawTotal: total,
      professionalPercentage: total ? (professionals / total) * 100 : 0,
      professionalPercentRounded: total ? Math.round((professionals / total) * 100) : 0,
      userPercentRounded: total ? 100 - Math.round((professionals / total) * 100) : 0,
    };
  });

  updateSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    this.searchInput.next(query.trim());
  }

  openFirstSearchResult(): void {
    const result = this.searchResults()[0];
    if (result) {
      this.openSearchResult(result);
      return;
    }
    const section = this.sectionResults()[0];
    if (section) {
      void this.router.navigate(['/espaces/admin', section.path]);
      this.clearSearch();
    }
  }

  openSearchResult(result: AdminSearchResult): void {
    void this.router.navigate(['/espaces/admin', result.type]);
    this.clearSearch();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.searchInput.next('');
  }

  searchTypeLabel(type: AdminSearchResult['type']): string {
    return ({ utilisateurs: 'Utilisateur', professionnels: 'Professionnel', aliments: 'Aliment',
      recettes: 'Recette', menus: 'Menu', contenus: 'Contenu' })[type];
  }

  activityName(item: JournalActivity): string {
    return [item.acteurPrenom, item.acteurNom].filter(Boolean).join(' ')
      || (item.acteurId === null ? 'Compte inconnu' : `Compte #${item.acteurId}`);
  }

  activityInitials(item: JournalActivity): string {
    return [item.acteurPrenom?.[0], item.acteurNom?.[0]].filter(Boolean).join('').toLocaleUpperCase('fr') || '?';
  }

  activityRole(item: JournalActivity): string {
    return ({ UTILISATEUR: 'Utilisateur', DIETETICIEN: 'Pro', NUTRITIONNISTE: 'Pro',
      ADMIN: 'Admin' } as Record<string, string>)[item.acteurRole ?? ''] ?? 'Compte';
  }

  activityLabel(value: string | null): string {
    return value ? formatStatusLabel(value) : 'Plateforme';
  }

  relativeTime(value: string): string {
    const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
    if (!Number.isFinite(minutes) || minutes < 0) return 'À l’instant';
    if (minutes < 60) return `Il y a ${Math.max(minutes, 1)} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    const days = Math.round(hours / 24);
    return `Il y a ${days} j`;
  }

  ngOnInit(): void {
    this.searchInput.pipe(
      switchMap((term) => {
        this.searchError.set(false);
        if (term.length < 2) {
          this.searchLoading.set(false);
          return of([] as AdminSearchResult[]);
        }
        this.searchLoading.set(true);
        return timer(250).pipe(
          switchMap(() => this.api.search(term)),
          catchError(() => {
            this.searchError.set(true);
            return of([] as AdminSearchResult[]);
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((results) => {
      this.searchResults.set(results);
      this.searchLoading.set(false);
    });

    const today = new Date();
    const firstMonth = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    this.api
      .statistics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (statistics) => this.statistics.set(statistics),
        error: () => this.statisticsError.set(true),
      });

    this.api
      .report(this.dateParameter(firstMonth), this.dateParameter(today))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => this.months.set(this.monthBars(report, firstMonth)),
        error: () => this.reportError.set(true),
      });

    this.api
      .recentActivity()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.activities.set(page.content),
        error: () => this.activitiesError.set(true),
      });

    this.api.createdMenusCount().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (count) => this.createdMenus.set(count),
      error: () => this.createdMenusError.set(true),
    });
    this.api.educationalContentCount().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (count) => this.educationalContent.set(count),
      error: () => this.educationalContentError.set(true),
    });
  }

  private dateParameter(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private monthBars(report: ActivityReport, firstMonth: Date): MonthBar[] {
    const counts = new Map<string, number>();
    for (const day of report.inscriptionsParJour) {
      const key = day.jour.slice(0, 7);
      counts.set(key, (counts.get(key) ?? 0) + day.nombre);
    }
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
      const key = this.dateParameter(date).slice(0, 7);
      return {
        key,
        label: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date),
        value: counts.get(key) ?? 0,
        height: 0,
      };
    });
    const maximum = Math.max(...months.map((month) => month.value), 1);
    return months.map((month) => ({
      ...month,
      height: month.value ? Math.max(4, (month.value / maximum) * 100) : 0,
    }));
  }
}
