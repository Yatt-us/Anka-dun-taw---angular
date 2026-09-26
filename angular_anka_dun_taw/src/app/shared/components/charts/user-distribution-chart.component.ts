import { Component } from '@angular/core';
@Component({
  selector: 'app-user-distribution-chart',
  template: `<figure>
    <svg viewBox="0 0 240 210" role="img" aria-labelledby="distributionTitle distributionDesc">
      <title id="distributionTitle">Répartition des utilisateurs</title>
      <desc id="distributionDesc">
        1 247 parents et 38 professionnels, soit 1 285 comptes. Environ 97 % de parents et 3 % de
        professionnels.
      </desc>
      <circle cx="120" cy="104" r="76" fill="none" stroke="var(--green)" stroke-width="22" />
      <circle
        cx="120"
        cy="104"
        r="76"
        fill="none"
        stroke="var(--yellow)"
        stroke-width="22"
        pathLength="100"
        [attr.stroke-dasharray]="professionalPercentage + ' ' + (100 - professionalPercentage)"
        transform="rotate(-90 120 104)"
      />
      <text x="120" y="105" class="total" text-anchor="middle">1 285</text>
      <text x="120" y="127" text-anchor="middle">Total</text>
    </svg>
    <figcaption>
      <span><i></i>Parents (97 %)</span><span><i class="yellow"></i>Pros (3 %)</span>
    </figcaption>
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
      text.total {
        font-size: 25px;
        font-weight: 700;
        fill: var(--ink);
      }
      figcaption {
        display: flex;
        justify-content: center;
        gap: 20px;
        font-size: 11px;
        color: var(--muted);
      }
      span {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      i {
        width: 10px;
        height: 10px;
        background: var(--green);
        border-radius: 2px;
      }
      i.yellow {
        background: var(--yellow);
      }
    `,
  ],
})
export class UserDistributionChartComponent {
  readonly professionalPercentage = (38 / 1285) * 100;
}
