import { describe, expect, it } from 'vitest';
import { MALI_ZONES, normalizeZones, zoneLabel } from './zones.data-access';

describe('régions du Mali', () => {
  it('conserve les 19 régions et Bamako avec leurs codes API', () => {
    expect(MALI_ZONES).toHaveLength(20);
    expect(MALI_ZONES[0].code).toBe('KAYES');
    expect(MALI_ZONES[18].code).toBe('BANDIAGARA');
    expect(MALI_ZONES[19].code).toBe('BAMAKO');
    expect(zoneLabel('DIOILA')).toBe('Dioïla');
  });

  it('complète une réponse API partielle sans perdre les libellés', () => {
    const zones = normalizeZones([{ code: 'KAYES', libelle: 'Kayes' }]);
    expect(zones).toHaveLength(20);
    expect(zones.find((zone) => zone.code === 'TAOUDENIT')?.libelle).toBe('Taoudénit');
  });
});
