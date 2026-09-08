import { describe, it, expect, beforeEach } from 'vitest';

import { registerEngine, getEngine, engineIds, _resetEngines } from './registry.js';
import { EngineError, type VideoEngine } from './types.js';

const fake = (): VideoEngine => ({ id: 'content2video', label: 'x' } as unknown as VideoEngine);

describe('engine registry', () => {
  beforeEach(() => _resetEngines());

  it('registra e devolve a mesma instância (memoizada)', () => {
    let calls = 0;
    registerEngine('content2video', () => { calls++; return fake(); });
    const a = getEngine('content2video');
    const b = getEngine('content2video');
    expect(a).toBe(b);
    expect(calls).toBe(1);
    expect(engineIds()).toEqual(['content2video']);
  });

  it('erro claro para motor desconhecido', () => {
    expect(() => getEngine('content2video')).toThrow(EngineError);
  });
});
