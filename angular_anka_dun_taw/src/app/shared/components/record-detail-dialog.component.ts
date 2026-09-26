import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
export interface RecordDetailData {
  title: string;
  subtitle: string;
  value: string;
  badge: string;
  note: string;
}
@Component({
  selector: 'app-record-detail-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `<h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content
      ><p class="subtitle">{{ data.subtitle }}</p>
      <div class="information">
        <span>Informations</span>
        <p>{{ data.value }}</p>
        <strong>{{ data.badge }}</strong>
      </div>
      <mat-form-field appearance="outline"
        ><mat-label>Note personnelle</mat-label
        ><textarea
          matInput
          [formControl]="note"
          rows="4"
          maxlength="500"
          placeholder="Ajouter une note pour cette démonstration"
        ></textarea
        ><mat-hint align="end">{{ note.value.length }} / 500</mat-hint></mat-form-field
      >
      <p class="notice">
        Cette note reste dans le prototype pendant votre session. Elle n’est pas envoyée au patient.
      </p></mat-dialog-content
    >
    <mat-dialog-actions align="end"
      ><button mat-button mat-dialog-close>Fermer</button
      ><button
        mat-flat-button
        (click)="save()"
        [disabled]="note.invalid || note.value.trim() === data.note"
      >
        Enregistrer la note
      </button></mat-dialog-actions
    >`,
  styles: [
    `
      :host {
        display: block;
      }
      .subtitle {
        color: var(--muted);
        font-size: 13px;
        margin: 0 0 24px;
      }
      .information {
        padding: 18px;
        background: white;
        border: 1px solid var(--line);
        border-radius: 12px;
        margin-bottom: 24px;
      }
      .information span,
      .notice {
        font-size: 12px;
        color: var(--muted);
      }
      .information p {
        font-size: 14px;
      }
      .information strong {
        font-size: 12px;
        color: var(--green);
      }
      mat-form-field {
        width: 100%;
      }
      .notice {
        line-height: 1.7;
      }
      mat-dialog-actions {
        padding: 16px 24px 24px;
      }
    `,
  ],
})
export class RecordDetailDialogComponent {
  readonly data = inject<RecordDetailData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<RecordDetailDialogComponent, string>);
  readonly note = new FormControl(this.data.note, {
    nonNullable: true,
    validators: [Validators.maxLength(500)],
  });
  save(): void {
    if (this.note.valid) this.ref.close(this.note.value.trim());
  }
}
