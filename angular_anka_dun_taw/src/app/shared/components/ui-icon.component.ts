import { Component, input, computed } from '@angular/core';
const PATHS: Record<string, string> = {
  home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7.87a4 4 0 0 1 0 7.75',
  pro: 'M9 3h6v4H9Zm-4 4h14v14H5Zm7 4v6m-3-3h6',
  leaf: 'M20 3C8 2 2 8 5 15s16 6 15-12ZM5 20 15 9',
  grid: 'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
  book: 'M12 5v16M3 3l9 2 9-2v16l-9 2-9-2Z',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0-6v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  clock: 'M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  message: 'M21 11a9 9 0 0 1-9 9H4l-3 2 2-7a9 9 0 1 1 18-4Zm-13 0h8m-8 4h5',
  calendar: 'M3 5h18v16H3ZM7 2v6m10-6v6M3 11h18',
  chart: 'M3 3v18h18M7 17v-5m5 5V7m5 10v-8',
  check: 'm5 12 4 4L19 6',
  plus: 'M12 4v16M4 12h16',
  menu: 'M4 6h16M4 12h16M4 18h16',
  refresh: 'M20 7v5h-5M4 17v-5h5m-4-5a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2',
  user: 'M20 21v-2a8 8 0 0 0-16 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  mail: 'M3 5h18v14H3Zm0 0 9 8 9-8',
  archive: 'M3 4h18v4H3Zm2 4v12h14V8m-10 4h6m-6 4h6',
  logout: 'M9 3H3v18h6m5-14 5 5-5 5m-7-5h13',
  search: 'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  download: 'M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4',
  trash: 'M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6',
  edit: 'M12 20h9M4 16l-.5 4.5L8 20l11-11-4-4L4 16Zm9-9 4 4',
  close: 'm6 6 12 12M18 6 6 18',
  warning: 'M12 3 2 21h20L12 3Zm0 6v5m0 3v1',
  'map-pin': 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  pie: 'M12 3v9h9M9 3.5A9 9 0 1 0 20.5 15M15 3.5V9h5.5',
  drop: 'M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13Z',
};
@Component({
  selector: 'app-icon',
  templateUrl: './ui-icon.component.html',
  styleUrl: './ui-icon.component.css',
})
export class UiIconComponent {
  readonly name = input('home');
  readonly path = computed(() => PATHS[this.name()] ?? PATHS['grid']);
}
