import { describe, it, expect } from 'vitest';

import { roteiroParaCenas } from './roteiro.js';

describe('roteiroParaCenas', () => {
  it('um parágrafo = uma cena, com narração integral', () => {
    const scenes = roteiroParaCenas('Primeira cena do vídeo.\n\nSegunda cena, com mais texto.');
    expect(scenes).toHaveLength(2);
    expect(scenes[0].narration).toBe('Primeira cena do vídeo.');
    expect(scenes[1].narration).toBe('Segunda cena, com mais texto.');
    expect(scenes[0].type).toBe('lead');
  });

  it('junta linhas do mesmo parágrafo e ignora blocos vazios', () => {
    const scenes = roteiroParaCenas('linha um\nlinha dois\n\n\n\noutro bloco');
    expect(scenes).toHaveLength(2);
    expect(scenes[0].narration).toBe('linha um linha dois');
  });

  it('texto vazio não gera cenas', () => {
    expect(roteiroParaCenas('   \n\n  ')).toHaveLength(0);
  });
});
