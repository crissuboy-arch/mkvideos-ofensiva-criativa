import { describe, it, expect } from 'vitest';

import type { EnqueueInput, QueueStore, VideoJob } from '../types.js';
import { EngineError } from '../engines/types.js';
import {
  missionToEnqueueInput,
  receiveMission,
  findJobByMission,
  jobToAthenaResult,
  missionStatus,
  type AthenaMission,
} from './adapter.js';

/** Store em memória só para os testes do adapter. */
function fakeStore(): QueueStore & { jobs: VideoJob[] } {
  const jobs: VideoJob[] = [];
  let seq = 0;
  const base = (over: Partial<VideoJob>): VideoJob => ({
    id: ++seq,
    skill: 'explicativo',
    input: 'x',
    opts: null,
    status: 'queued',
    result_path: null,
    error: null,
    notify: 'sempre',
    send_video: 0,
    chat_id: null,
    created_at: Date.now(),
    started_at: null,
    finished_at: null,
    ...over,
  });
  return {
    jobs,
    enqueue: (input: EnqueueInput) => {
      const job = base({
        skill: input.skill,
        input: input.input,
        opts: input.opts,
        notify: input.notify,
        send_video: input.sendVideo ? 1 : 0,
        chat_id: input.chatId,
      });
      jobs.push(job);
      return job.id;
    },
    getNext: () => jobs.find((j) => j.status === 'queued') ?? null,
    getRunning: () => jobs.find((j) => j.status === 'running') ?? null,
    markRunning: (id: number) => { jobs.find((j) => j.id === id)!.status = 'running'; },
    markDone: (id: number, p: string) => {
      const j = jobs.find((jj) => jj.id === id)!;
      j.status = 'done';
      j.result_path = p;
    },
    markFailed: (id: number, e: string) => {
      const j = jobs.find((jj) => jj.id === id)!;
      j.status = 'failed';
      j.error = e;
    },
    cancel: () => false,
    list: (n = 100) => jobs.slice(-n),
    failStaleRunning: () => 0,
  };
}

const MISSION: AthenaMission = {
  schema_version: '1.0',
  mission_id: 'missao-teste-001',
  mission_type: 'CRIAR_VIDEO',
  objective: 'Vídeo explicativo sobre funil de vendas',
  requires_human_approval: true,
  requested_outputs: ['video'],
  context: { vertical: true },
};

describe('adapter Athena ↔ MKVideos', () => {
  it('traduz missão CRIAR_VIDEO válida para a fila', () => {
    const store = fakeStore();
    const { jobId, deduped } = receiveMission(store, MISSION);
    expect(deduped).toBe(false);
    const job = store.jobs.find((j) => j.id === jobId)!;
    expect(job.skill).toBe('explicativo');
    expect(job.input).toBe('Vídeo explicativo sobre funil de vendas');
    expect(JSON.parse(job.opts!).athena_mission_id).toBe('missao-teste-001');
    expect(job.send_video).toBe(1); // requires_human_approval → vídeo ao Telegram
    expect(job.chat_id).toBe('athena');
  });

  it('reenvio da mesma missão não duplica (idempotência)', () => {
    const store = fakeStore();
    const a = receiveMission(store, MISSION);
    const b = receiveMission(store, MISSION);
    expect(b.deduped).toBe(true);
    expect(b.jobId).toBe(a.jobId);
    expect(store.jobs).toHaveLength(1);
  });

  it('rejeita mission_type diferente de CRIAR_VIDEO', () => {
    const store = fakeStore();
    expect(() => receiveMission(store, { ...MISSION, mission_type: 'CRIAR_COPY' })).toThrow(EngineError);
  });

  it('rejeita missão sem objective', () => {
    expect(() => missionToEnqueueInput({ ...MISSION, objective: '  ' })).toThrow(/objective/);
  });

  it('rejeita mission_id em formato inválido', () => {
    expect(() => missionToEnqueueInput({ ...MISSION, mission_id: 'x' })).toThrow(/mission_id/);
  });

  it('usa video_skill do contexto quando válido', () => {
    const input = missionToEnqueueInput({ ...MISSION, context: { video_skill: 'demo' } });
    expect(input.skill).toBe('demo');
  });

  it('sem requires_human_approval, não anexa vídeo (só callback)', () => {
    const store = fakeStore();
    const { jobId } = receiveMission(store, { ...MISSION, requires_human_approval: false });
    expect(store.jobs.find((j) => j.id === jobId)!.send_video).toBe(0);
  });

  it('jobToAthenaResult: done → outputs.video', () => {
    const store = fakeStore();
    const { jobId } = receiveMission(store, MISSION);
    store.markDone(jobId, '/v/out.mp4');
    const r = jobToAthenaResult(store.jobs[0]);
    expect(r).toEqual({ mission_id: 'missao-teste-001', status: 'done', outputs: { video: '/v/out.mp4' }, error: null });
  });

  it('jobToAthenaResult: failed → error', () => {
    const store = fakeStore();
    const { jobId } = receiveMission(store, MISSION);
    store.markFailed(jobId, 'ffmpeg quebrou');
    const r = jobToAthenaResult(store.jobs[0]);
    expect(r.status).toBe('failed');
    expect(r.error).toBe('ffmpeg quebrou');
    expect(r.outputs).toBeNull();
  });

  it('missionStatus: missão desconhecida → 404', () => {
    expect(() => missionStatus(fakeStore(), 'nao-existe')).toThrow(EngineError);
  });

  it('findJobByMission encontra pelo mission_id', () => {
    const store = fakeStore();
    receiveMission(store, MISSION);
    expect(findJobByMission(store, 'missao-teste-001')!.input).toContain('funil');
    expect(findJobByMission(store, 'outra')).toBeNull();
  });
});
