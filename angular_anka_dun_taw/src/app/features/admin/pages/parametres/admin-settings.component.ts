import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminDashboardApi, AdminSearchResult } from '../../data-access/admin-dashboard.data-access';
import { UiIconComponent } from '../../../../shared/components/ui-icon.component';

@Component({
  selector: 'app-admin-settings',
  imports: [UiIconComponent],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.css',
})
export class AdminSettingsComponent {
  private readonly dashboard = inject(AdminDashboardApi);
  private readonly router = inject(Router);
  readonly search = signal('');
  readonly results = signal<AdminSearchResult[]>([]);
  readonly loading = signal(false);
  readonly hasSearch = computed(() => this.search().trim().length > 1);

  constructor() {
    effect((onCleanup) => {
      const query = this.search().trim();
      this.results.set([]);
      this.loading.set(query.length > 1);
      if (query.length < 2) return;
      let subscription: Subscription | undefined;
      const timer = setTimeout(() => {
        subscription = this.dashboard.search(query).subscribe({
          next: (results) => { this.results.set(results); this.loading.set(false); },
          error: () => this.loading.set(false),
        });
      }, 250);
      onCleanup(() => { clearTimeout(timer); subscription?.unsubscribe(); });
    });
  }
  setSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  openResult(result: AdminSearchResult): void { this.search.set(''); void this.router.navigate(['/espaces/admin', result.type]); }
  openUsers(): void { void this.router.navigate(['/espaces/admin/utilisateurs']); }
}
