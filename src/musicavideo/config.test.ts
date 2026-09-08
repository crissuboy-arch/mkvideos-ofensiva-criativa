import { describe, it, expect } from 'vitest';

import { motorEhPago } from './config.js';

describe('musicavideo/config', () => {
  it('identifica motores pagos', () => {
    expect(motorEhPago('kie:suno-v4.5')).toBe(true);
    expect(motorEhPago('kling:kling-v2_5')).toBe(true);
    expect(motorEhPago('fal:kling-v3-turbo')).toBe(true);
  });
  it('identifica motores gratuitos/locais', () => {
    expect(motorEhPago('agnes:agnes-image-2.1-flash')).toBe(false);
    expect(motorEhPago('inemaimg:flux2-klein')).toBe(false);
  });
});
