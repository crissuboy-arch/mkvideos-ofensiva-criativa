import { describe, it, expect } from 'vitest';
import { layoutTimeline, DEFAULT_TIMING, round } from './timing.js';

describe('layoutTimeline', () => {
  it('encadeia cenas sem buracos (cada start = end anterior)', () => {
    const { scenes, total } = layoutTimeline([2, 3, 1]);
    expect(scenes).toHaveLength(3);
    expect(scenes[0].start).toBe(0);
    expect(scenes[1].start).toBe(scenes[0].end);
    expect(scenes[2].start).toBe(scenes[1].end);
    expect(total).toBe(scenes[2].end);
  });

  it('respeita LEAD/TAIL na duração e no início do áudio', () => {
    const { LEAD, TAIL } = DEFAULT_TIMING;
    const { scenes } = layoutTimeline([4]);
    expect(scenes[0].dur).toBe(round(LEAD + 4 + TAIL));
    expect(scenes[0].audioStart).toBe(round(LEAD));
    expect(scenes[0].audioDur).toBe(4);
  });

  it('numera as cenas a partir de 1', () => {
    const { scenes } = layoutTimeline([1, 1]);
    expect(scenes.map((s) => s.i)).toEqual([1, 2]);
  });

  it('aceita timing custom', () => {
    const { scenes } = layoutTimeline([2], { LEAD: 1, TAIL: 1, FADE: 0.5 });
    expect(scenes[0].dur).toBe(4);
  });
});
