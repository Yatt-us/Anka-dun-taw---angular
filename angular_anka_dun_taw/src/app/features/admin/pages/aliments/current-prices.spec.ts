import { describe, expect, it } from 'vitest';
import { FoodPrice } from '../../../../shared/models/workspace-list.models';
import { currentPricesForZone } from './current-prices';

describe('prix actuels par région', () => {
  it('écarte les autres régions et les relevés expirés ou futurs', () => {
    const prices: FoodPrice[] = [
      { id: 1, zone: 'DIOILA', prix: 800, dateDebut: '2026-01-01', dateFin: '2026-12-31' },
      { id: 2, zone: 'BAMAKO', prix: 900, dateDebut: '2026-01-01' },
      { id: 3, zone: 'DIOILA', prix: 700, dateDebut: '2025-01-01', dateFin: '2025-12-31' },
      { id: 4, zone: 'DIOILA', prix: 1000, dateDebut: '2027-01-01' },
    ];
    expect(currentPricesForZone(prices, 'DIOILA', '2026-10-24').map((price) => price.id)).toEqual([1]);
  });
});
