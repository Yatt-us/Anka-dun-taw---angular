import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';
import {
  ActivityReport,
  AdminDashboardApi,
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly numberFormat = new Intl.NumberFormat('fr-FR');

  readonly statistics = signal<AdminStatistics | null>(null);
  readonly statisticsError = signal(false);
  readonly reportError = signal(false);
  readonly activitiesError = signal(false);
  readonly months = signal<MonthBar[] | null>(null);
  readonly activities = signal<JournalActivity[] | null>(null);
  readonly showActivityList = signal(false);
  readonly hasRegistrations = computed(
    () => this.months()?.some((month) => month.value > 0) ?? false,
  );

  readonly metrics = computed(() => {
    const statistics = this.statistics();
    const value = (count: number | undefined) =>
      count === undefined ? (this.statisticsError() ? '—' : '…') : this.numberFormat.format(count);
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
        tone: '',
      },
      {
        label: 'Aliments locaux disponibles',
        value: value(statistics?.alimentsLocauxDisponibles),
        detail,
        icon: 'leaf',
        tone: '',
      },
      {
        label: 'Recettes publiées',
        value: value(statistics?.recettesPubliees),
        detail,
        icon: 'book',
        tone: 'orange',
      },
      {
        label: 'Menus publiés',
        value: value(statistics?.menusPublies),
        detail,
        icon: 'calendar',
        tone: '',
      },
      {
        label: 'Rendez-vous demandés',
        value: value(statistics?.rendezVousDemandes),
        detail,
        icon: 'calendar',
        tone: 'yellow',
      },
    ];
  });

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
    };
  });

  toggleActivityList(): void { this.showActivityList.update((visible) => !visible); }

  ngOnInit(): void {
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
