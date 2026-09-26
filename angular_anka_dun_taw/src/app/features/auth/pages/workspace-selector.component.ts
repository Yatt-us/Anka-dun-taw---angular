import { UiIconComponent } from '../../../shared/components/ui-icon.component';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-workspace-selector',
  imports: [RouterLink, UiIconComponent],
  template: `
    <main class="chooser-page">
      <header class="chooser-header">
        <a class="brand" routerLink="/espaces"
          ><span class="brand-mark"><app-icon name="leaf" /></span
          ><span
            ><strong>Anka Dùn Taw</strong><small>PLATEFORME DE SANTÉ NUTRITIONNELLE</small></span
          ></a
        >
        <span class="demo-chip"><i></i> Prototype front-end</span>
      </header>
      <section class="chooser-content">
        <div class="welcome-copy">
          <span class="kicker">BIENVENUE SUR VOTRE ESPACE DE TRAVAIL</span>
          <h1>Choisissez votre<br /><em>espace de travail</em></h1>
          <p>
            Chaque espace présente les outils adaptés à votre rôle dans l’accompagnement
            nutritionnel.
          </p>
        </div>
        <div class="role-grid">
          <a class="role-card admin-card" routerLink="/espaces/admin/tableau-de-bord">
            <div class="role-card-top">
              <span class="role-icon">AD</span><span class="card-arrow" aria-hidden="true">↗</span>
            </div>
            <span class="role-label">ESPACE 01</span>
            <h2>Administrateur</h2>
            <p>
              Gérez les comptes, les professionnels, les aliments et les contenus de la plateforme.
            </p>
            <span class="role-action">Ouvrir l’espace <b aria-hidden="true">→</b></span>
          </a>
          <a class="role-card diet-card" routerLink="/espaces/dieteticien/tableau-de-bord">
            <div class="role-card-top">
              <span class="role-icon">DT</span><span class="card-arrow" aria-hidden="true">↗</span>
            </div>
            <span class="role-label">ESPACE 02</span>
            <h2>Diététicien(ne)</h2>
            <p>
              Suivez vos patients et composez des menus adaptés à leurs objectifs et à leur budget.
            </p>
            <span class="role-action">Ouvrir l’espace <b aria-hidden="true">→</b></span>
          </a>
          <a class="role-card nutrition-card" routerLink="/espaces/nutritionniste/tableau-de-bord">
            <div class="role-card-top">
              <span class="role-icon">NT</span><span class="card-arrow" aria-hidden="true">↗</span>
            </div>
            <span class="role-label">ESPACE 03</span>
            <h2>Nutritionniste</h2>
            <p>
              Organisez les consultations, répondez aux questions et partagez vos recommandations.
            </p>
            <span class="role-action">Ouvrir l’espace <b aria-hidden="true">→</b></span>
          </a>
        </div>
        <div class="notice">
          <span class="notice-icon">i</span
          ><span
            ><strong>Prototype sans API</strong
            ><small
              >Les noms, chiffres et listes affichés sont des exemples de démonstration. Les notes
              restent uniquement en mémoire et disparaissent au rechargement.</small
            ></span
          >
        </div>
      </section>
      <footer class="chooser-footer">
        <span>ANKA DÙN TAW</span><span>Une alimentation locale, personnalisée et accessible</span
        ><span>© 2026</span>
      </footer>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }
      .chooser-page {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background:
          radial-gradient(ellipse at 12% 40%, #e6f1e9 0, transparent 32%),
          radial-gradient(ellipse at 90% 80%, #fbefd8 0, transparent 30%), var(--cream);
      }
      .chooser-header {
        height: 80px;
        padding: 0 clamp(20px, 5vw, 76px);
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #dfe8e0;
        background: #ffffffb5;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 11px;
        color: inherit;
        text-decoration: none;
      }
      .brand-mark {
        width: 42px;
        height: 42px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--green);
        color: #fff;
        font-size: 21px;
        font-weight: 800;
      }
      .brand > span:last-child {
        display: grid;
        gap: 3px;
      }
      .brand strong {
        font-size: 15px;
      }
      .brand small {
        font-size: 8px;
        letter-spacing: 1.05px;
        color: var(--muted);
        font-weight: 700;
      }
      .demo-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 20px;
        color: #617067;
        font-size: 10px;
      }
      .demo-chip i {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #e3a832;
      }
      .chooser-content {
        width: min(1080px, calc(100% - 40px));
        margin: auto;
        padding: 54px 0 62px;
      }
      .welcome-copy {
        text-align: center;
        max-width: 620px;
        margin: 0 auto 38px;
      }
      .kicker {
        font-size: 9px;
        letter-spacing: 1.5px;
        font-weight: 750;
        color: var(--green);
      }
      h1 {
        margin: 12px 0 12px;
        font-size: clamp(32px, 4vw, 48px);
        line-height: 1.1;
        letter-spacing: -1.8px;
        font-weight: 750;
      }
      h1 em {
        font-style: normal;
        color: var(--green);
      }
      .welcome-copy p {
        max-width: 480px;
        margin: auto;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
      }
      .role-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }
      .role-card {
        min-height: 270px;
        display: flex;
        flex-direction: column;
        padding: 22px 22px 20px;
        border: 1px solid #e4e9e3;
        border-radius: 18px;
        background: #fff;
        color: inherit;
        text-decoration: none;
        box-shadow: 0 9px 26px #27392d08;
        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease,
          border-color 0.18s ease;
      }
      .role-card:hover,
      .role-card:focus-visible {
        transform: translateY(-4px);
        box-shadow: 0 18px 35px #27392d12;
        border-color: #a9cdb7;
        outline: none;
      }
      .role-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 25px;
      }
      .role-icon {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: #eaf3ed;
        color: var(--green);
        font-weight: 750;
        font-size: 12px;
      }
      .diet-card .role-icon {
        background: #fbefe5;
        color: #c7773c;
      }
      .nutrition-card .role-icon {
        background: #fff4d9;
        color: #9a741e;
      }
      .card-arrow {
        font-size: 18px;
        color: #91a097;
      }
      .role-label {
        font-size: 8px;
        letter-spacing: 1.3px;
        color: #8a968e;
        font-weight: 700;
      }
      .role-card h2 {
        margin: 6px 0 8px;
        font-size: 18px;
        letter-spacing: -0.4px;
      }
      .role-card p {
        margin: 0;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.65;
      }
      .role-action {
        margin-top: auto;
        padding-top: 19px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--green);
        font-size: 11px;
        font-weight: 700;
      }
      .role-action b {
        font-size: 18px;
        font-weight: 500;
      }
      .notice {
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 670px;
        margin: 25px auto 0;
        padding: 13px 16px;
        background: #fff9e9;
        border: 1px solid #f2e6c6;
        border-radius: 12px;
      }
      .notice-icon {
        width: 19px;
        height: 19px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #f0ce78;
        color: #68521f;
        font-size: 11px;
        font-weight: 800;
      }
      .notice > span:last-child {
        display: grid;
        gap: 3px;
      }
      .notice strong {
        font-size: 10px;
      }
      .notice small {
        font-size: 9px;
        line-height: 1.5;
        color: #817a66;
      }
      .chooser-footer {
        padding: 17px clamp(20px, 5vw, 76px);
        border-top: 1px solid #dfe8e0;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        color: #849088;
        font-size: 9px;
      }
      .chooser-footer span:first-child {
        font-weight: 750;
        letter-spacing: 1px;
        color: #607068;
      }
      @media (max-width: 760px) {
        .chooser-header {
          height: 68px;
          padding-inline: 17px;
        }
        .chooser-content {
          padding: 38px 0 42px;
        }
        .welcome-copy {
          margin-bottom: 25px;
        }
        .welcome-copy p {
          font-size: 12px;
        }
        .role-grid {
          grid-template-columns: 1fr;
          gap: 11px;
        }
        .role-card {
          min-height: unset;
          padding: 17px;
        }
        .role-card-top {
          margin-bottom: 16px;
        }
        .role-action {
          padding-top: 14px;
        }
        .chooser-footer span:nth-child(2) {
          display: none;
        }
      }
    `,
  ],
})
export class WorkspaceSelectorComponent {}
