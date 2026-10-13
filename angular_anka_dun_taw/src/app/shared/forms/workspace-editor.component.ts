import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { WorkspaceEditorService, EditorKind, Choice } from './workspace-editor.service';

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'url' | 'checkbox';
interface Field {
  key: string; label: string; type: FieldType; required?: boolean; min?: number; max?: number;
  options?: { value: string | number; label: string }[]; lookup?: 'foods' | 'categories' | 'recipes'; help?: string;
}
interface Ingredient { alimentId: number | null; quantite: number | null; unite: string }
interface Meal { recetteId: number | null; jour: number; typeRepas: string; nombrePortions: number }
interface QuizQuestion { enonce: string; points: number; explication: string; propositions: { texte: string; correcte: boolean }[] }

const ZONES = ['KAYES', 'KOULIKORO', 'SIKASSO', 'SEGOU', 'MOPTI', 'TOMBOUCTOU', 'GAO', 'KIDAL', 'BAMAKO'];
const REGION_LABELS: Record<string, string> = {
  KAYES: 'Kayes', KOULIKORO: 'Koulikoro', SIKASSO: 'Sikasso', SEGOU: 'Ségou', MOPTI: 'Mopti',
  TOMBOUCTOU: 'Tombouctou', GAO: 'Gao', KIDAL: 'Kidal', BAMAKO: 'District de Bamako',
};
const regionChoices = () => ZONES.map((value) => ({ value, label: REGION_LABELS[value] ?? value }));
const ALLERGENES = ['ARACHIDE', 'LAIT', 'OEUF', 'POISSON', 'CRUSTACES', 'FRUITS_A_COQUE', 'SOJA', 'GLUTEN', 'SESAME'];
const choice = (values: string[]) => values.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
const FIELDS: Record<EditorKind, Field[]> = {
  category: [
    { key: 'nom', label: 'Nom de la catégorie', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'imageUrl', label: 'Adresse de l’image', type: 'url' },
    { key: 'groupeAssiette', label: 'Groupe de l’assiette', type: 'select', options: choice(['LEGUMES_FRUITS', 'CEREALES_FECULENTS', 'PROTEINES', 'AUTRES']) },
  ],
  food: [
    { key: 'nom', label: 'Nom de l’aliment', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'utilisation', label: 'Utilisation', type: 'text' },
    { key: 'uniteMesure', label: 'Unité de mesure', type: 'text', required: true },
    { key: 'origine', label: 'Provenance du produit', type: 'select', required: true, help: 'Indique si le produit est local ou importé. La région de provenance du prix se renseigne dans sa fiche de prix.', options: [
      { value: 'LOCAL', label: 'Local' }, { value: 'IMPORTE', label: 'Importé' },
      { value: 'MIXTE', label: 'Mixte' }, { value: 'NON_RENSEIGNE', label: 'Non renseignée' },
    ] },
    { key: 'categorieId', label: 'Catégorie', type: 'select', required: true, lookup: 'categories' },
    { key: 'calories', label: 'Calories', type: 'number', min: 0 },
    { key: 'proteines', label: 'Protéines (g)', type: 'number', min: 0 },
    { key: 'glucides', label: 'Glucides (g)', type: 'number', min: 0 },
    { key: 'lipides', label: 'Lipides (g)', type: 'number', min: 0 },
    { key: 'fibres', label: 'Fibres (g)', type: 'number', min: 0 },
    { key: 'imageUrl', label: 'URL ou chemin de l’image', type: 'url' },
    { key: 'allergenes', label: 'Allergènes présents ou possibles', type: 'text', help: 'Substances pouvant provoquer une réaction chez certaines personnes. Codes acceptés : ARACHIDE, LAIT, OEUF, POISSON, CRUSTACES, FRUITS_A_COQUE, SOJA, GLUTEN, SESAME.' },
    { key: 'allergenesVerifies', label: 'Composition vérifiée pour les allergènes', type: 'checkbox', help: 'Cochez uniquement si les informations sur les allergènes ont été vérifiées.' },
    { key: 'moisDebutSaison', label: 'Début de saison (mois 1 à 12)', type: 'number', min: 1, max: 12 },
    { key: 'moisFinSaison', label: 'Fin de saison (mois 1 à 12)', type: 'number', min: 1, max: 12 },
  ],
  price: [
    { key: 'zone', label: 'Région du relevé de prix', type: 'select', required: true, help: 'Le prix dépend du marché local. Ajoutez un relevé distinct pour chaque région où le prix diffère.', options: regionChoices() },
    { key: 'prix', label: 'Prix en F CFA', type: 'number', required: true, min: 0 },
    { key: 'quantiteReference', label: 'Quantité de référence', type: 'number', required: true, min: 0.001 },
    { key: 'unite', label: 'Unité', type: 'text', required: true },
    { key: 'dateDebut', label: 'Date de début', type: 'date', required: true },
    { key: 'dateFin', label: 'Date de fin', type: 'date' },
    { key: 'source', label: 'Source du prix', type: 'text' },
  ],
  recipe: [
    { key: 'nom', label: 'Nom de la recette', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'instructions', label: 'Préparation', type: 'textarea' },
    { key: 'nombrePersonnes', label: 'Nombre de personnes', type: 'number', required: true, min: 1 },
    { key: 'dureePreparationMinutes', label: 'Durée (minutes)', type: 'number', min: 0 },
    { key: 'difficulte', label: 'Difficulté', type: 'select', options: choice(['FACILE', 'MOYEN', 'DIFFICILE']) },
    { key: 'imageUrl', label: 'Adresse de l’image', type: 'url' },
  ],
  menu: [
    { key: 'titre', label: 'Titre du menu', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'type', label: 'Type de menu', type: 'select', required: true, options: choice(['PERSONNALISE', 'PETIT_BUDGET', 'FAMILIAL']) },
    { key: 'dateDebut', label: 'Date de début', type: 'date', required: true },
    { key: 'dateFin', label: 'Date de fin', type: 'date' },
    { key: 'zone', label: 'Région du patient', type: 'select', options: regionChoices() },
    { key: 'beneficiaireIds', label: 'N° des bénéficiaires (séparés par une virgule)', type: 'text', required: true },
    { key: 'objectifId', label: 'N° de l’objectif nutritionnel (facultatif)', type: 'number', min: 1 },
    { key: 'budgetId', label: 'N° du budget (facultatif)', type: 'number', min: 1 },
    { key: 'recommandations', label: 'Recommandations', type: 'textarea' },
  ],
  advice: [
    { key: 'titre', label: 'Titre du conseil', type: 'text', required: true },
    { key: 'categorie', label: 'Catégorie', type: 'text' },
    { key: 'contenu', label: 'Conseil', type: 'textarea', required: true },
  ],
  article: [
    { key: 'titre', label: 'Titre de l’article', type: 'text', required: true },
    { key: 'theme', label: 'Thème', type: 'select', required: true, options: choice(['NUTRITION', 'PRODUITS_LOCAUX', 'EQUILIBRE_ALIMENTAIRE', 'HYGIENE_ALIMENTAIRE']) },
    { key: 'contenu', label: 'Article', type: 'textarea', required: true },
  ],
  profile: [
    { key: 'specialite', label: 'Spécialité', type: 'text', required: true },
    { key: 'qualification', label: 'Qualification', type: 'text', required: true },
    { key: 'numeroOrdre', label: 'Numéro d’ordre', type: 'text' },
    { key: 'anneesExperience', label: 'Années d’expérience', type: 'number', min: 0 },
    { key: 'biographie', label: 'Biographie', type: 'textarea' },
  ],
  badge: [
    { key: 'nom', label: 'Nom du badge', type: 'text', required: true },
    { key: 'conditionObtention', label: 'Condition d’obtention', type: 'text', required: true },
    { key: 'points', label: 'Points', type: 'number', required: true, min: 0 },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'imageUrl', label: 'Adresse de l’image', type: 'url' },
    { key: 'typeRegle', label: 'Règle automatique', type: 'select', options: choice(['JOURS_REPAS_SUIVIS', 'QUIZ_TERMINES']) },
    { key: 'seuil', label: 'Seuil de la règle', type: 'number', min: 1 },
  ],
  challenge: [
    { key: 'titre', label: 'Titre du défi', type: 'text', required: true },
    { key: 'objectif', label: 'Objectif', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'nombrePoints', label: 'Points', type: 'number', required: true, min: 0 },
    { key: 'dateDebut', label: 'Date de début', type: 'date', required: true },
    { key: 'dateFin', label: 'Date de fin', type: 'date', required: true },
    { key: 'typeRegle', label: 'Règle automatique', type: 'select', options: choice(['JOURS_REPAS_SUIVIS', 'QUIZ_TERMINES']) },
    { key: 'seuil', label: 'Seuil de la règle', type: 'number', min: 1 },
  ],
  quiz: [
    { key: 'titre', label: 'Titre du quiz', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'imageUrl', label: 'Adresse de l’image', type: 'url' },
    { key: 'dateQuestionDuJour', label: 'Date de la question du jour', type: 'date' },
  ],
};

@Component({
  selector: 'app-workspace-editor',
  imports: [FormsModule, MatButtonModule],
  templateUrl: './workspace-editor.component.html',
  styleUrl: './workspace-editor.component.css',
})
export class WorkspaceEditorComponent {
  private readonly api = inject(WorkspaceEditorService);
  private readonly destroyRef = inject(DestroyRef);
  readonly kind = input.required<EditorKind>();
  readonly entityId = input<number>();
  readonly relatedId = input<number>();
  readonly initialData = input<Record<string, unknown> | undefined>();
  readonly saved = output<{ kind: EditorKind; id?: number; data: Record<string, unknown> }>();
  readonly cancelled = output<void>();
  readonly fields = computed(() => FIELDS[this.kind()]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly imagePreviewFailed = signal(false);
  readonly imageUploading = signal(false);
  readonly imageUploadError = signal('');
  private readonly localImagePreview = signal('');
  private localImageObjectUrl = '';
  readonly foods = signal<Choice[]>([]);
  readonly categories = signal<Choice[]>([]);
  readonly recipes = signal<Choice[]>([]);
  model: Record<string, string | number | boolean | null> = {};
  ingredients: Ingredient[] = [{ alimentId: null, quantite: null, unite: 'g' }];
  meals: Meal[] = [{ recetteId: null, jour: 1, typeRepas: 'DEJEUNER', nombrePortions: 1 }];
  quizQuestions: QuizQuestion[] = [this.newQuestion()];

  constructor() {
    this.destroyRef.onDestroy(() => this.clearLocalImagePreview());
    effect((onCleanup) => {
      const kind = this.kind();
      const id = this.entityId();
      const initialData = this.initialData();
      this.model = { origine: 'LOCAL', type: 'PERSONNALISE', dateDebut: new Date().toISOString().slice(0, 10), quantiteReference: 1, unite: 'kg', zone: 'BAMAKO', allergenesVerifies: false };
      this.ingredients = [{ alimentId: null, quantite: null, unite: 'g' }];
      this.meals = [{ recetteId: null, jour: 1, typeRepas: 'DEJEUNER', nombrePortions: 1 }];
      this.error.set('');
      this.imagePreviewFailed.set(false);
      this.imageUploadError.set('');
      this.clearLocalImagePreview();
      if (kind === 'food') this.api.choices('categories-aliments').subscribe({ next: (page) => this.categories.set(page.content), error: () => this.error.set('Chargement des catégories impossible.') });
      if (kind === 'recipe') this.api.choices('aliments').subscribe({ next: (page) => this.foods.set(page.content), error: () => this.error.set('Chargement des aliments impossible.') });
      if (kind === 'menu') this.api.choices('recettes').subscribe({ next: (page) => this.recipes.set(page.content), error: () => this.error.set('Chargement des recettes impossible.') });
      if (id && initialData) {
        this.hydrate(kind, initialData);
      } else if (kind === 'profile' || (id && kind !== 'price')) {
        this.loading.set(true);
        const sub = this.api.load(kind, id).subscribe({
          next: (data) => {
            this.hydrate(kind, data);
            this.loading.set(false);
          },
          error: () => { this.error.set('Impossible de charger les informations à modifier.'); this.loading.set(false); },
        });
        onCleanup(() => sub.unsubscribe());
      }
    });
  }

  private hydrate(kind: EditorKind, data: Record<string, unknown>): void {
    this.model = { ...this.model, ...Object.fromEntries(Object.entries(data).filter(
      (entry): entry is [string, string | number | boolean | null] =>
        FIELDS[kind].some((field) => field.key === entry[0]) &&
        (entry[1] === null || ['string', 'number', 'boolean'].includes(typeof entry[1])),
    )) };
    if (kind === 'food' && Array.isArray(data['allergenes'])) this.model['allergenes'] = data['allergenes'].join(', ');
    if (kind === 'recipe' && Array.isArray(data['ingredients'])) {
      this.ingredients = data['ingredients'].filter((item): item is { alimentId: number; quantite: number; unite: string } =>
        typeof item === 'object' && item !== null && 'alimentId' in item && 'quantite' in item && 'unite' in item,
      ).map((item) => ({ alimentId: item.alimentId, quantite: item.quantite, unite: item.unite }));
      if (!this.ingredients.length) this.ingredients = [{ alimentId: null, quantite: null, unite: 'g' }];
    }
    if (kind === 'menu') {
      if (Array.isArray(data['beneficiaireIds'])) this.model['beneficiaireIds'] = data['beneficiaireIds'].join(', ');
      if (Array.isArray(data['repas'])) {
        this.meals = data['repas'].filter((item): item is Meal => typeof item === 'object' && item !== null &&
          'recetteId' in item && 'jour' in item && 'typeRepas' in item && 'nombrePortions' in item)
          .map((item) => ({ recetteId: item.recetteId, jour: item.jour, typeRepas: item.typeRepas, nombrePortions: item.nombrePortions }));
        if (!this.meals.length) this.meals = [{ recetteId: null, jour: 1, typeRepas: 'DEJEUNER', nombrePortions: 1 }];
      }
    }
    if (kind === 'quiz' && Array.isArray(data['questions'])) {
      this.quizQuestions = data['questions'].filter((item): item is QuizQuestion =>
        typeof item === 'object' && item !== null && 'enonce' in item && 'propositions' in item)
        .map((item) => ({ enonce: item.enonce, points: item.points, explication: item.explication,
          propositions: item.propositions.map((proposition) => ({ texte: proposition.texte, correcte: proposition.correcte })) }));
      if (!this.quizQuestions.length) this.quizQuestions = [this.newQuestion()];
    }
  }

  options(field: Field): { value: string | number; label: string }[] {
    const source = field.lookup === 'foods' ? this.foods() : field.lookup === 'categories' ? this.categories() : this.recipes();
    return field.lookup ? source.map((item) => ({ value: item.id, label: item.nom })) : field.options ?? [];
  }
  foodListed(id: number | null): boolean { return id !== null && this.foods().some((food) => food.id === id); }
  recipeListed(id: number | null): boolean { return id !== null && this.recipes().some((recipe) => recipe.id === id); }
  addIngredient(): void { this.ingredients.push({ alimentId: null, quantite: null, unite: 'g' }); }
  removeIngredient(index: number): void { if (this.ingredients.length > 1) this.ingredients.splice(index, 1); }
  addMeal(): void { this.meals.push({ recetteId: null, jour: 1, typeRepas: 'DEJEUNER', nombrePortions: 1 }); }
  removeMeal(index: number): void { if (this.meals.length > 1) this.meals.splice(index, 1); }
  addQuestion(): void { this.quizQuestions.push(this.newQuestion()); }
  removeQuestion(index: number): void { if (this.quizQuestions.length > 1) this.quizQuestions.splice(index, 1); }
  addProposition(question: QuizQuestion): void { question.propositions.push({ texte: '', correcte: false }); }
  removeProposition(question: QuizQuestion, index: number): void { if (question.propositions.length > 2) question.propositions.splice(index, 1); }
  private newQuestion(): QuizQuestion { return { enonce: '', points: 1, explication: '', propositions: [{ texte: '', correcte: true }, { texte: '', correcte: false }] }; }

  foodImagePreview(): string {
    if (this.localImagePreview()) return this.localImagePreview();
    const value = this.model['imageUrl'];
    return typeof value === 'string' ? value.trim() : '';
  }
  imagePreviewError(): void { this.imagePreviewFailed.set(true); }
  imageUrlChanged(): void { this.imagePreviewFailed.set(false); this.clearLocalImagePreview(); }

  uploadFoodImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.imageUploadError.set('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.imageUploadError.set('Choisissez une image JPEG, PNG ou WebP.'); input.value = ''; return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.imageUploadError.set('L’image ne peut pas dépasser 5 Mo.'); input.value = ''; return;
    }
    this.clearLocalImagePreview();
    this.localImageObjectUrl = URL.createObjectURL(file);
    this.localImagePreview.set(this.localImageObjectUrl);
    this.imagePreviewFailed.set(false);
    this.imageUploading.set(true);
    this.api.uploadFoodImage(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.model['imageUrl'] = response.url;
        this.imageUploading.set(false);
        this.clearLocalImagePreview();
        this.imagePreviewFailed.set(false);
        input.value = '';
      },
      error: (cause: unknown) => {
        this.imageUploading.set(false);
        this.clearLocalImagePreview();
        this.imageUploadError.set(this.describeUploadError(cause));
        input.value = '';
      },
    });
  }

  private clearLocalImagePreview(): void {
    if (this.localImageObjectUrl) URL.revokeObjectURL(this.localImageObjectUrl);
    this.localImageObjectUrl = '';
    this.localImagePreview.set('');
  }

  private describeUploadError(cause: unknown): string {
    if (cause instanceof HttpErrorResponse) {
      if (typeof cause.error?.message === 'string') return cause.error.message;
      if (cause.status === 413) return 'L’image dépasse la taille maximale autorisée.';
    }
    return 'Téléversement impossible. Vérifiez votre connexion et réessayez.';
  }

  private validImageUrl(value: string): boolean {
    if (/^\/(?!\/)/.test(value)) return true;
    try { return ['http:', 'https:'].includes(new URL(value).protocol); }
    catch { return false; }
  }

  submit(form: NgForm): void {
    this.error.set('');
    if (this.imageUploading()) { this.error.set('Attendez la fin du téléversement de l’image.'); return; }
    if (form.invalid) { form.control.markAllAsTouched(); return; }
    const kind = this.kind();
    const allowed = new Set(FIELDS[kind].map((field) => field.key));
    const payload: Record<string, unknown> = Object.fromEntries(Object.entries(this.model).filter(
      ([key, value]) => allowed.has(key) && value !== '' && value !== null && value !== undefined,
    ));
    if (kind === 'food' && !this.entityId()) payload['disponible'] = true;
    if (kind === 'food') {
      const imageUrl = String(payload['imageUrl'] ?? '').trim();
      if (imageUrl.length > 500) { this.error.set('L’adresse de l’image ne peut pas dépasser 500 caractères.'); return; }
      if (imageUrl && !this.validImageUrl(imageUrl)) { this.error.set('Utilisez une URL d’image HTTP(S) ou un chemin local commençant par /.'); return; }
      payload['imageUrl'] = imageUrl || null;
    }
    if (kind === 'food' && !!payload['moisDebutSaison'] !== !!payload['moisFinSaison']) {
      this.error.set('Renseignez les deux mois de saison ou laissez les deux champs vides.'); return;
    }
    if (kind === 'food') {
      const allergens = String(payload['allergenes'] ?? '').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);
      if (allergens.some((value) => !ALLERGENES.includes(value))) {
        this.error.set(`Codes d’allergènes possibles : ${ALLERGENES.join(', ')}.`); return;
      }
      payload['allergenes'] = [...new Set(allergens)];
    }
    if (kind === 'price') payload['devise'] = 'XOF';
    if (kind === 'recipe') {
      if (this.ingredients.some((item) => !item.alimentId || !item.quantite || !item.unite.trim())) { this.error.set('Renseignez chaque ingrédient.'); return; }
      payload['ingredients'] = this.ingredients.map((item, index) => ({ ...item, ordre: index }));
    }
    if (kind === 'menu') {
      const ids = String(payload['beneficiaireIds'] ?? '').split(',').map((value) => Number(value.trim()));
      if (ids.some((id) => !Number.isInteger(id) || id < 1) || this.meals.some((item) => !item.recetteId || item.jour < 1 || item.nombrePortions <= 0)) {
        this.error.set('Vérifiez les bénéficiaires et les repas du menu.'); return;
      }
      payload['beneficiaireIds'] = [...new Set(ids)];
      payload['repas'] = this.meals.map((item) => ({ ...item }));
    }
    if (kind === 'badge' || kind === 'challenge') {
      if (!!payload['typeRegle'] !== !!payload['seuil']) { this.error.set('Choisissez une règle et son seuil ensemble.'); return; }
    }
    if (kind === 'challenge' && String(payload['dateFin']) < String(payload['dateDebut'])) {
      this.error.set('La fin du défi doit être après son début.'); return;
    }
    if (kind === 'quiz') {
      if (this.quizQuestions.some((question) => !question.enonce.trim() || question.points < 1 ||
        question.propositions.some((proposition) => !proposition.texte.trim()) ||
        question.propositions.filter((proposition) => proposition.correcte).length !== 1)) {
        this.error.set('Chaque question doit avoir un énoncé, deux réponses ou plus et une seule bonne réponse.'); return;
      }
      payload['questions'] = this.quizQuestions.map((question, index) => ({
        enonce: question.enonce.trim(), points: question.points, ordre: index, explication: question.explication,
        propositions: question.propositions.map((proposition, order) => ({ ...proposition, ordre: order })),
      }));
    }
    this.busy.set(true);
    this.api.save(kind, payload, this.entityId(), this.relatedId()).subscribe({
      next: (result: unknown) => { this.busy.set(false); const id = typeof result === 'object' && result !== null && 'id' in result ? Number(result.id) : undefined; this.saved.emit({ kind, id, data: payload }); },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message : 'Enregistrement impossible. Vérifiez les informations puis réessayez.');
      },
    });
  }
}
