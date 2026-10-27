// Motor MoneyPrinterTurbo dentro do MKVideos (motor ADICIONAL, não substitui
// nenhum motor existente). É um cliente fino sobre a API do motor isolado,
// normalizando tarefas do upstream para os tipos estáveis de engines/types.
//
// O que o MoneyPrinterTurbo FAZ: tema/roteiro → vídeo faceless (stock ou
// materiais locais + TTS + legendas + música). O que NÃO faz: URL → Vídeo
// com gate visual, projetos editáveis, editor visual ou lista de tarefas
// (o upstream não tem endpoint de listagem). Essas operações devolvem
// NOT_IMPLEMENTED (501) em vez de fingirem existir.
//
// Narração: o motor usa a voz configurada no seu config.toml. Neste VM, o
// Edge TTS FALHA (proxy interceta o TLS para speech.platform.bing.com —
// provado 27/10/2026), por isso a via local (CLI com --custom-audio-file,
// narração Piper/Kokoro) é o caminho documentado para testes locais; a via
// API com voz do motor exige rede do motor para o provedor de TTS.
// Nenhuma publicação automática existe: o MP4 fica para revisão humana.

import { Readable } from 'node:stream';

import {
  EngineError, EngineNotAvailableError, EngineNotImplementedError,
  type AspectRatio, type EngineCapabilities, type EngineConfigInfo, type EngineHealth,
  type EngineId, type EngineJob, type EngineProject, type ProjectTransformInput,
  type UrlToVideoInput, type VideoEngine,
} from '../types.js';
import {
  buildMptPtBrVerticalRequest, cancelMptTask, downloadMptArtifact, getMptTaskStatus,
  isTerminalMptState, loadMptConfig, MPT_TASK_STATE, pollMptTask, getMptTaskVideoUrls,
  submitMptVideo, type MptTaskStatus, type MptVideoRequest,
} from './client.js';

const CAPABILITIES: EngineCapabilities = {
  urlToVideo: false,
  visualGate: false,
  editByPrompt: false,
  duplicate: false,
  resumableRender: false,
  visualEditor: false,
  // O MPT usa stock/materiais próprios, não os provedores de cena do MKVideos.
  clipProviders: [],
};

/** Etapas do pipeline do upstream (ordem do CLI: --stop-at). */
export const MPT_PHASES = ['script', 'terms', 'audio', 'subtitle', 'materials', 'video'];

export interface MptThemeInput {
  subject: string;
  script?: string;
  terms?: string[];
  aspectRatio?: AspectRatio;
  voiceName?: string;
  bgmType?: string;
  clipDuration?: number;
  materials?: { provider?: string; url: string; duration?: number }[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function toAspect(v: string | undefined): AspectRatio {
  return v === '16:9' ? '16:9' : '9:16';
}

function statusToJobStatus(state: number): EngineJob['status'] {
  if (state === MPT_TASK_STATE.COMPLETE) return 'completed';
  if (state === MPT_TASK_STATE.FAILED) return 'failed';
  if (state === MPT_TASK_STATE.PROCESSING) return 'running';
  return 'queued';
}

export function normalizeMptJob(
  status: MptTaskStatus,
  subject: string,
  aspectRatio: AspectRatio,
): EngineJob {
  const failedIdx = status.failed_stage ? MPT_PHASES.indexOf(status.failed_stage) : -1;
  const now = nowIso();
  return {
    id: status.task_id,
    type: 'generation',
    project: subject,
    status: statusToJobStatus(status.state),
    stage: status.failed_stage
      ?? (typeof status.progress === 'number' ? `${status.progress}%` : 'processando'),
    phaseIndex: failedIdx >= 0 ? failedIdx : 0,
    phases: [...MPT_PHASES],
    phaseTimings: [],
    aspectRatio,
    includeCta: false,
    conversationStyleLabel: undefined,
    speechPaceLabel: undefined,
    visualPresetName: null,
    visualGatePreviewUrl: null,
    cancelable: status.state === MPT_TASK_STATE.PROCESSING,
    retryable: status.state === MPT_TASK_STATE.FAILED,
    resumeAvailable: false,
    skippedPhases: [],
    error: status.error ?? null,
    createdAt: now,
    updatedAt: now,
    totalDurationMs: 0,
    logs: status.failed_stage ? [`etapa com falha: ${status.failed_stage}`] : [],
  };
}

export class MoneyPrinterTurboEngine implements VideoEngine {
  readonly id: EngineId = 'moneyprinterturbo';
  readonly label = 'MoneyPrinterTurbo (tema → vídeo faceless)';
  readonly capabilities = CAPABILITIES;

  /** Pedidos submetidos por esta instância (para listJobs/retry). */
  private readonly submitted = new Map<string, { request: MptVideoRequest; subject: string }>();

  /** Só para testes: repõe o registo de tarefas submetidas. */
  _resetSubmitted(): void {
    this.submitted.clear();
  }

  async health(env: NodeJS.ProcessEnv = process.env): Promise<EngineHealth> {
    const checks: EngineHealth['checks'] = [];
    let configured = true;
    try {
      loadMptConfig(env);
      checks.push({ name: 'configuração', ok: true, detail: 'MPT_API_BASE_URL e MPT_API_KEY presentes.', required: true });
    } catch (e) {
      configured = false;
      checks.push({ name: 'configuração', ok: false, detail: (e as Error).message, required: true });
    }
    if (!configured) {
      return {
        id: this.id, available: false, ready: false,
        message: 'MoneyPrinterTurbo não configurado.',
        checks,
      };
    }
    // O upstream não tem endpoint /health: sondar uma tarefa inexistente.
    // 404 = servidor alcançável + chave aceite; 401 = chave rejeitada.
    let serverOk = false;
    let authOk = false;
    let detail = '';
    try {
      const cfg = loadMptConfig(env);
      const res = await fetch(new URL('/api/v1/tasks/__health__', cfg.baseUrl), {
        headers: { 'x-api-key': cfg.key },
        signal: AbortSignal.timeout(5000),
      });
      serverOk = true;
      authOk = res.status !== 401;
      detail = res.status === 404
        ? 'Servidor alcançável, chave aceite.'
        : res.status === 401
          ? 'Servidor alcançável, chave rejeitada (401).'
          : `Servidor respondeu HTTP ${res.status}.`;
    } catch (e) {
      detail = `Servidor inalcançável: ${(e as Error).message}`;
    }
    checks.push({ name: 'servidor', ok: serverOk, detail, required: true });
    checks.push({ name: 'autenticação', ok: authOk, detail, required: true });
    return {
      id: this.id,
      available: serverOk,
      ready: serverOk && authOk,
      message: serverOk && authOk
        ? 'MoneyPrinterTurbo pronto.'
        : 'MoneyPrinterTurbo indisponível — ver verificações.',
      checks,
    };
  }

  async config(): Promise<EngineConfigInfo> {
    return {
      language: 'pt-BR',
      voiceId: 'pt-BR-FranciscaNeural',
      aspectRatio: '9:16',
      resolution: '1080x1920',
      // O motor não tem duração-alvo fixa: depende dos clipes e do roteiro.
      targetDuration: 0,
      minimumQuality: 0,
      defaultVisualPresetId: '',
      visualPresets: [],
      conversationStyles: [],
      speechPaces: [],
    };
  }

  /**
   * Tema/roteiro → tarefa no motor isolado. É a entrada própria do MPT;
   * o fluxo URL → Vídeo continua a ser do motor content2video.
   */
  async createFromTheme(
    input: MptThemeInput,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<EngineJob> {
    if (!input.subject?.trim()) {
      throw new EngineError('Assunto obrigatório.', 'MPT_VALIDATION', 400);
    }
    const aspectRatio = input.aspectRatio ?? '9:16';
    const request = aspectRatio === '9:16'
      ? buildMptPtBrVerticalRequest({
        subject: input.subject, script: input.script, terms: input.terms,
        materials: input.materials, voiceName: input.voiceName,
        bgmType: input.bgmType, clipDuration: input.clipDuration,
      })
      : {
        video_subject: input.subject.trim(),
        ...(input.script?.trim() ? { video_script: input.script.trim() } : {}),
        ...(input.terms ? { video_terms: input.terms } : {}),
        video_language: 'pt-BR',
        video_aspect: aspectRatio === '16:9' ? '16:9' as const : '9:16' as const,
        voice_name: input.voiceName ?? 'pt-BR-FranciscaNeural',
        subtitle_enabled: true,
        video_count: 1,
        video_clip_duration: input.clipDuration ?? 5,
        ...(input.bgmType ? { bgm_type: input.bgmType } : {}),
        ...(input.materials?.length
          ? { video_source: 'local', video_materials: input.materials } : {}),
      };
    const task = await submitMptVideo(request, env);
    this.submitted.set(task.task_id, { request, subject: input.subject.trim() });
    return {
      id: task.task_id,
      type: 'generation',
      project: input.subject.trim(),
      status: 'queued',
      stage: 'enviada',
      phaseIndex: 0,
      phases: [...MPT_PHASES],
      phaseTimings: [],
      aspectRatio,
      includeCta: false,
      visualPresetName: null,
      visualGatePreviewUrl: null,
      cancelable: true,
      retryable: false,
      resumeAvailable: false,
      skippedPhases: [],
      error: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      totalDurationMs: 0,
      logs: [],
    };
  }

  /** Estado normalizado de uma tarefa do motor. */
  async getJob(
    taskId: string,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<EngineJob> {
    const status = await getMptTaskStatus(taskId, env);
    const known = this.submitted.get(taskId);
    return normalizeMptJob(status, known?.subject ?? taskId, toAspect(known?.request.video_aspect));
  }

  /** Espera até estado terminal e devolve o job normalizado. */
  async pollJob(
    taskId: string,
    options: { intervalMs?: number; maxWaitMs?: number; env?: NodeJS.ProcessEnv } = {},
  ): Promise<EngineJob> {
    const status = await pollMptTask(taskId, {
      intervalMs: options.intervalMs, maxWaitMs: options.maxWaitMs, env: options.env,
    });
    const known = this.submitted.get(taskId);
    return normalizeMptJob(status, known?.subject ?? taskId, toAspect(known?.request.video_aspect));
  }

  /** Baixa o primeiro MP4 da tarefa concluída (Buffer). */
  async downloadJobVideo(
    taskId: string,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<Buffer> {
    const status = await getMptTaskStatus(taskId, env);
    if (status.state !== MPT_TASK_STATE.COMPLETE) {
      throw new EngineError(
        `Tarefa ${taskId} ainda não concluída (estado ${status.state}).`,
        'MPT_NOT_COMPLETE',
        409,
      );
    }
    const urls = getMptTaskVideoUrls(status);
    if (!urls.length) {
      throw new EngineError(`Tarefa ${taskId} concluída sem artefacto de vídeo.`, 'MPT_NO_VIDEO', 502);
    }
    return downloadMptArtifact(urls[0], env);
  }

  // -- Interface VideoEngine: só o que o upstream suporta de verdade. --

  createDirection(_input: UrlToVideoInput): Promise<EngineJob> {
    return Promise.reject(new EngineNotImplementedError(
      'URL → Vídeo no motor MoneyPrinterTurbo (usar createFromTheme com tema/roteiro)',
    ));
  }

  approveDirection(_jobId: string): Promise<EngineJob> {
    return Promise.reject(new EngineNotImplementedError('Gate visual no motor MoneyPrinterTurbo'));
  }

  regenerateDirection(_jobId: string): Promise<EngineJob> {
    return Promise.reject(new EngineNotImplementedError('Regeneração com gate no motor MoneyPrinterTurbo'));
  }

  async listJobs(env: NodeJS.ProcessEnv = process.env): Promise<EngineJob[]> {
    const results = await Promise.allSettled(
      [...this.submitted.entries()].map(async ([taskId, known]) => {
        const status = await getMptTaskStatus(taskId, env);
        return normalizeMptJob(status, known.subject, toAspect(known.request.video_aspect));
      }),
    );
    return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  }

  async cancelJob(taskId: string, env: NodeJS.ProcessEnv = process.env): Promise<EngineJob> {
    await cancelMptTask(taskId, env);
    const known = this.submitted.get(taskId);
    const now = nowIso();
    return {
      id: taskId, type: 'generation', project: known?.subject ?? taskId,
      status: 'cancelled', stage: 'cancelada', phaseIndex: 0, phases: [...MPT_PHASES],
      phaseTimings: [], aspectRatio: toAspect(known?.request.video_aspect), includeCta: false,
      visualPresetName: null, visualGatePreviewUrl: null, cancelable: false,
      retryable: false, resumeAvailable: false, skippedPhases: [], error: null,
      createdAt: now, updatedAt: now, totalDurationMs: 0, logs: [],
    };
  }

  async retryRender(
    taskId: string,
    mode: 'resume' | 'restart',
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<EngineJob> {
    if (mode === 'resume') {
      throw new EngineNotImplementedError('Retomar render no motor MoneyPrinterTurbo');
    }
    const known = this.submitted.get(taskId);
    if (!known) {
      throw new EngineError(`Tarefa ${taskId} desconhecida nesta instância.`, 'MPT_UNKNOWN_JOB', 404);
    }
    const task = await submitMptVideo(known.request, env);
    this.submitted.set(task.task_id, known);
    return {
      id: task.task_id, type: 'generation', project: known.subject, status: 'queued',
      stage: 'enviada', phaseIndex: 0, phases: [...MPT_PHASES], phaseTimings: [],
      aspectRatio: toAspect(known.request.video_aspect), includeCta: false,
      visualPresetName: null, visualGatePreviewUrl: null, cancelable: true,
      retryable: false, resumeAvailable: false, skippedPhases: [], error: null,
      createdAt: nowIso(), updatedAt: nowIso(), totalDurationMs: 0, logs: [],
    };
  }

  listProjects(): Promise<EngineProject[]> {
    return Promise.reject(new EngineNotImplementedError('Projetos no motor MoneyPrinterTurbo'));
  }

  editProject(_slug: string, _input: ProjectTransformInput): Promise<EngineJob> {
    return Promise.reject(new EngineNotImplementedError('Edição de projeto no motor MoneyPrinterTurbo'));
  }

  duplicateProject(_slug: string, _input: ProjectTransformInput): Promise<EngineJob> {
    return Promise.reject(new EngineNotImplementedError('Duplicação de projeto no motor MoneyPrinterTurbo'));
  }

  renderProject(_slug: string): Promise<EngineJob> {
    return Promise.reject(new EngineNotImplementedError('Render de projeto no motor MoneyPrinterTurbo'));
  }

  openEditor(_slug: string): Promise<{ url: string }> {
    return Promise.reject(new EngineNotImplementedError('Editor visual no motor MoneyPrinterTurbo'));
  }

  async fetchMedia(
    relPath: string,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<{ status: number; contentType: string; body: NodeJS.ReadableStream }> {
    const buf = await downloadMptArtifact(relPath, env);
    const ext = relPath.split('.').pop()?.toLowerCase();
    const contentType = ext === 'mp4' ? 'video/mp4'
      : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
      : ext === 'srt' ? 'text/plain'
      : 'application/octet-stream';
    return { status: 200, contentType, body: Readable.from(buf) };
  }
}

export function moneyprinterturbo(): MoneyPrinterTurboEngine {
  return new MoneyPrinterTurboEngine();
}

export { EngineNotAvailableError };
