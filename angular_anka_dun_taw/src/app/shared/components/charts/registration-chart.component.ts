import { Component } from '@angular/core';
@Component({
  selector: 'app-registration-chart',
  template: `<figure>
    <svg viewBox="0 0 600 218" role="img" aria-labelledby="registrationTitle registrationDesc">
      <title id="registrationTitle">Inscriptions mensuelles, de mai à octobre</title>
      <desc id="registrationDesc">
        Données de démonstration. Mai 110, juin 180, juillet 280, août 230, septembre 370, octobre
        480 inscriptions.
      </desc>
      @for (month of months; track month.label; let i = $index) {
        <g>
          <rect
            [attr.x]="30 + i * 96"
            [attr.y]="184 - month.value / 3"
            width="64"
            [attr.height]="month.value / 3"
            rx="5"
            fill="var(--green)"
          />
          <text [attr.x]="62 + i * 96" y="211" text-anchor="middle">{{ month.label }}</text>
          <title>{{ month.label }} : {{ month.value }} inscriptions</title>
        </g>
      }
    </svg>
    <details>
      <summary>Afficher les valeurs</summary>
      <ul>
        @for (month of months; track month.label) {
          <li>{{ month.label }} : {{ month.value }}</li>
        }
      </ul>
    </details>
  </figure>`,
  styles: [
    `
      figure {
        margin: 0;
      }
      svg {
        display: block;
        width: 100%;
        height: 170px;
      }
      text {
        font:
          12px Poppins,
          sans-serif;
        fill: var(--muted);
      }
      details {
        font-size: 10px;
        color: var(--muted);
        margin-top: 8px;
      }
      summary {
        cursor: pointer;
      }
      ul {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        padding-left: 16px;
      }
    `,
  ],
})
export class RegistrationChartComponent {
  readonly months = [
    { label: 'Mai', value: 110 },
    { label: 'Juin', value: 180 },
    { label: 'Juill', value: 280 },
    { label: 'Août', value: 230 },
    { label: 'Sept', value: 370 },
    { label: 'Oct', value: 480 },
  ];
}
