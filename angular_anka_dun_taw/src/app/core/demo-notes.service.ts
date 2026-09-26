import { Injectable } from '@angular/core';

/** Mémoire de démonstration : les notes disparaissent au rechargement de la page. */
@Injectable({ providedIn: 'root' })
export class DemoNotesService {
  private readonly values = new Map<string, string>();
  get(key: string): string {
    return this.values.get(key) ?? '';
  }
  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}
