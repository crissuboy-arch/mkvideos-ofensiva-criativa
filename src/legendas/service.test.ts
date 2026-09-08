import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { Readable } from 'node:stream';

import { LegendasService } from './service.js';
import { LegendaStore } from './store.js';
import { VideoImporter } from './import.js';
import { requireAuthorization } from '../cost/gate.js';
import { CostAuthorizationRequiredError } from '../cost/types.js';
import type { OtimizevideoService } from '../otimizevideo/service.js';

function fakeOtv(dir: string): OtimizevideoService {
  return {
    ingest: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '', id: 'vid1' }),
    transcrever: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    dirDo: vi.fn().mockReturnValue(dir),
  } as unknown as OtimizevideoService;
}

/** otv falso que aplica o MESMO gate de custo real (groq pago, whisper_local grátis). */
function gatedOtv(dir: string): OtimizevideoService {
  const transcrever = vi.fn(async (_otvId: string, provider: string, confirmed: boolean) => {
    requireAuthorization(
      { module: 'otimizevideo', phase: 'transcricao', providerId: provider, estimatedUsd: 0.04, billable: provider === 'groq' },
      { confirmed },
    );
    return { code: 0, stdout: '', stderr: '' };
  });
  return {
    ingest: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '', id: 'vid1' }),
    transcrever,
    dirDo: vi.fn().mockReturnValue(dir),
  } as unknown as OtimizevideoService;
}

describe('LegendasService', () => {
  let dataDir: string;
  let env: NodeJS.ProcessEnv;
  let otvDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'leg-test-'));
    env = { MKIVIDEOS_DATA_DIR: dataDir };
    otvDir = path.join(dataDir, 'otvwork');
    mkdirSync(otvDir, { recursive: true });
    writeFileSync(path.join(otvDir, 'transcript.json'), JSON.stringify({
      idioma: 'pt', provedor: 'groq/x',
      palavras: [
        { t: 'Primeira', ini: 0, fim: 0.5 }, { t: 'frase.', ini: 0.5, fim: 1.0 },
        { t: 'Segunda', ini: 1.5, fim: 2.0 }, { t: 'frase.', ini: 2.0, fim: 2.5 },
      ],
      fins_segmento: [1.0, 2.5],
    }));
  });
  afterEach(() => rmSync(dataDir, { recursive: true, force: true }));

  it('create exige que o arquivo de vídeo exista', () => {
    const svc = new LegendasService(env, { otv: fakeOtv(otvDir) });
    expect(() => svc.create('/nao/existe.mp4')).toThrow(/não encontrado/);
  });

  it('transcribe roda otimizevideo, converte transcript em cues e salva', async () => {
    const video = path.join(dataDir, 'meu-video.mp4');
    writeFileSync(video, 'fake');
    const otv = fakeOtv(otvDir);
    const svc = new LegendasService(env, { store: new LegendaStore(env), otv });
    const project = svc.create(video, 'Meu Vídeo');
    const { cues } = await svc.transcribe(project.id, { confirmed: true });
    expect(otv.ingest).toHaveBeenCalledWith(video);
    expect(otv.transcrever).toHaveBeenCalledWith('vid1', 'groq', true);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('Primeira frase.');
    expect(svc.get(project.id)?.cueCount).toBe(2);
    expect(svc.get(project.id)?.idioma).toBe('pt');
  });

  it('setCues e shift limpam o vídeo queimado anterior', async () => {
    const video = path.join(dataDir, 'v.mp4');
    writeFileSync(video, 'fake');
    const svc = new LegendasService(env, { otv: fakeOtv(otvDir) });
    const p = svc.create(video);
    svc.setCues(p.id, [{ index: 1, start: 0, end: 1, text: 'oi' }]);
    const shifted = svc.shift(p.id, 2);
    expect(shifted[0]).toMatchObject({ start: 2, end: 3 });
    expect(svc.get(p.id)?.burnedVideoPath).toBeUndefined();
  });

  it('createFromUpload salva o stream e cria o projeto (fonte: arquivo local)', async () => {
    const svc = new LegendasService(env, { otv: fakeOtv(otvDir), importer: new VideoImporter(env) });
    const project = await svc.createFromUpload(Readable.from(Buffer.from('mp4-bytes')), 'Aula 01.mp4', 'Aula 01');
    expect(project.title).toBe('Aula 01');
    expect(project.sourceVideo).toMatch(/_imports/);
    expect(project.sourceVideo.endsWith('.mp4')).toBe(true);
    expect(svc.get(project.id)?.id).toBe(project.id);
  });

  it('createFromYoutube usa o importador (injetado) e cria o projeto', async () => {
    const video = path.join(dataDir, 'baixado.mp4');
    writeFileSync(video, 'yt');
    const importer = { fromYoutube: vi.fn().mockResolvedValue({ path: video, title: 'Vídeo do YouTube' }) } as unknown as VideoImporter;
    const svc = new LegendasService(env, { otv: fakeOtv(otvDir), importer });
    const project = await svc.createFromYoutube('https://youtu.be/abc');
    expect(importer.fromYoutube).toHaveBeenCalledWith('https://youtu.be/abc');
    expect(project.title).toBe('Vídeo do YouTube');
    expect(svc.get(project.id)?.sourceVideo).toBe(path.resolve(video));
  });

  it('transcribePlan delega ao construtor de plano e não executa transcrição', async () => {
    const video = path.join(dataDir, 'v.mp4');
    writeFileSync(video, 'fake');
    const otv = gatedOtv(otvDir);
    const planBuilder = vi.fn().mockResolvedValue({
      durationSeconds: 60, durationLabel: '1:00', providers: [], recommendedProviderId: 'groq', localReady: false, localHint: '',
    });
    const svc = new LegendasService(env, { otv, importer: new VideoImporter(env), planBuilder });
    const p = svc.create(video);
    const plan = await svc.transcribePlan(p.id);
    expect(planBuilder).toHaveBeenCalledWith(path.resolve(video), env);
    expect(plan.durationLabel).toBe('1:00');
    expect(otv.transcrever).not.toHaveBeenCalled();
  });

  it('transcribePlan lança quando o projeto não existe', async () => {
    const svc = new LegendasService(env, { otv: fakeOtv(otvDir) });
    await expect(svc.transcribePlan('inexistente')).rejects.toThrow(/não existe/);
  });

  it('SEGURANÇA: transcribe com groq SEM confirmação é bloqueado e não gera legendas', async () => {
    const video = path.join(dataDir, 'v.mp4');
    writeFileSync(video, 'fake');
    const otv = gatedOtv(otvDir);
    const svc = new LegendasService(env, { otv, importer: new VideoImporter(env) });
    const p = svc.create(video);
    await expect(svc.transcribe(p.id, { provider: 'groq' })).rejects.toBeInstanceOf(CostAuthorizationRequiredError);
    await expect(svc.transcribe(p.id, { provider: 'groq', confirmed: false })).rejects.toBeInstanceOf(CostAuthorizationRequiredError);
    expect(svc.get(p.id)?.cueCount).toBe(0);
  });

  it('SEGURANÇA: transcribe SEM provedor (default groq) também exige confirmação explícita', async () => {
    const video = path.join(dataDir, 'v.mp4');
    writeFileSync(video, 'fake');
    const otv = gatedOtv(otvDir);
    const svc = new LegendasService(env, { otv, importer: new VideoImporter(env) });
    const p = svc.create(video);
    await expect(svc.transcribe(p.id, {})).rejects.toBeInstanceOf(CostAuthorizationRequiredError);
  });

  it('transcribe com whisper_local (grátis) roda sem confirmação', async () => {
    const video = path.join(dataDir, 'v.mp4');
    writeFileSync(video, 'fake');
    const otv = gatedOtv(otvDir);
    const svc = new LegendasService(env, { otv, importer: new VideoImporter(env) });
    const p = svc.create(video);
    const { cues } = await svc.transcribe(p.id, { provider: 'whisper_local' });
    expect(otv.transcrever).toHaveBeenCalledWith('vid1', 'whisper_local', false);
    expect(cues).toHaveLength(2);
  });

  it('transcribe com groq + confirmação explícita executa', async () => {
    const video = path.join(dataDir, 'v.mp4');
    writeFileSync(video, 'fake');
    const otv = gatedOtv(otvDir);
    const svc = new LegendasService(env, { otv, importer: new VideoImporter(env) });
    const p = svc.create(video);
    const { cues } = await svc.transcribe(p.id, { provider: 'groq', confirmed: true });
    expect(otv.transcrever).toHaveBeenCalledWith('vid1', 'groq', true);
    expect(cues).toHaveLength(2);
  });

  it('burn falha claramente quando não há legendas', async () => {
    const video = path.join(dataDir, 'v.mp4');
    writeFileSync(video, 'fake');
    const svc = new LegendasService(env, { otv: fakeOtv(otvDir) });
    const p = svc.create(video);
    await expect(svc.burn(p.id)).rejects.toThrow(/não há legendas/);
  });
});
