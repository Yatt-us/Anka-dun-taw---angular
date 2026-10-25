import { FoodPrice } from '../../../../shared/models/workspace-list.models';

export function currentPricesForZone(prices: FoodPrice[], zone: string, today: string): FoodPrice[] {
  return prices.filter((price) => price.zone === zone
    && !!price.dateDebut && price.dateDebut <= today
    && (!price.dateFin || price.dateFin >= today));
}
