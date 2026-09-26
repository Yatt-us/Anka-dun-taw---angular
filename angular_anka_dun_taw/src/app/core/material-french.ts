import { MatPaginatorIntl } from '@angular/material/paginator';
export function frenchPaginator(): MatPaginatorIntl {
  const labels = new MatPaginatorIntl();
  labels.itemsPerPageLabel = 'Éléments par page';
  labels.nextPageLabel = 'Page suivante';
  labels.previousPageLabel = 'Page précédente';
  labels.firstPageLabel = 'Première page';
  labels.lastPageLabel = 'Dernière page';
  labels.getRangeLabel = (page, size, length) =>
    length === 0
      ? '0 sur 0'
      : `${page * size + 1}–${Math.min((page + 1) * size, length)} sur ${length}`;
  return labels;
}
