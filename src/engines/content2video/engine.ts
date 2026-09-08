// Adaptador do motor content2video → interface VideoEngine do MKVideos.
// É um cliente HTTP fino sobre o processo gerenciado (process.ts), normalizando
// os payloads do upstream para os tipos estáveis de src/engines/types.ts.

import { Readable } from 'node:stream';

import {
  EngineError, EngineNotAvailableError,
  type AspectRatio, type EngineCapabilities, type EngineConfigInfo, type EngineHealth,
  type EngineId, type EngineJob, type EngineProject, type ProjectTransformInput,
  type UrlToVideoInput, type VideoEngine,
} from '../types.js';
import { implementedProviderIds } from '../providers/registry.js';
import { ensureEngineProcess, type RunningEngine } from './process.js';

const CAPABILITIES: EngineCapabilities = {
  urlToVideo: true,
  visualGate: true,
  editByPrompt: true,
  duplicate: true,
  resumableRender: true,
  visualEditor: true,
  clipProviders: implementedProviderIds(),
};

interface RawJob {
  id: string; type: string; project: string; status: string; stage: string;
  phaseIndex: number; phases: string[]; aspectRatio: string; includeCta: boolean;
  conversationStyleLabel?: string; speechPaceLabel?: string; visualPresetName?: string | null;
  visualGate?: { previewUrl: string | null } | null;
  cancelable: boolean; retryable: boolean; resumeAvailable: boolean;
  skippedPhases?: number[]; error: string | null; createdAt: string; updatedAt: string;
  totalDurationMs?: number; logs?: string[];
  phaseTimings?: { phase: string; phaseIndex: number; startedAt: string | null; endedAt: string | null; durationMs: number | null }[];
}

interface RawProject {
  slug: string; name: string; modifiedAt: string; aspectRatio: string; includeCta: boolean;
  conversationStyleLabel: string; speechPaceLabel: string; visualPresetName: string;
  thumbnail: string | null; preview: string | null;
  renders: { name: string; size: number; modifiedAt: string; url: string }[];
}

function asAspect(v: string): AspectRatio {
  return v === '16:9' ? '16:9' : '9:16';
}

function normalizeJob(j: RawJob): EngineJob {
  return {
    id: j.id,
    type: (['generation', 'duplicate', 'edit', 'render'].includes(j.type) ? j.type : 'generation') as EngineJob['type'],
    project: j.project,
    status: j.status as EngineJob['status'],
    stage: j.stage,
    phaseIndex: j.phaseIndex ?? 0,
    phases: j.phases ?? [],
    phaseTimings: (j.phaseTimings ?? []).map((t) => ({
      phase: t.phase, phaseIndex: t.phaseIndex,
      startedAt: t.startedAt, endedAt: t.endedAt, durationMs: t.durationMs,
    })),
    aspectRatio: asAspect(j.aspectRatio),
    includeCta: j.includeCta !== false,
    conversationStyleLabel: j.conversationStyleLabel,
    speechPaceLabel: j.speechPaceLabel,
    visualPresetName: j.visualPresetName ?? null,
    visualGatePreviewUrl: j.visualGate?.previewUrl ?? null,
    cancelable: !!j.cancelable,
    retryable: !!j.retryable,
    resumeAvailable: !!j.resumeAvailable,
    skippedPhases: j.skippedPhases ?? [],
    error: j.error ?? null,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
    totalDurationMs: j.totalDurationMs ?? 0,
    logs: j.logs ?? [],
  };
}

function normalizeProject(p: RawProject): EngineProject {
  return {
    slug: p.slug,
    name: p.name,
    modifiedAt: p.modifiedAt,
    aspectRatio: asAspect(p.aspectRatio),
    includeCta: p.includeCta !== false,
    conversationStyleLabel: p.conversationStyleLabel,
    speechPaceLabel: p.speechPaceLabel,
    visualPresetName: p.visualPresetName,
    thumbnailUrl: p.thumbnail ?? null,
    previewUrl: p.preview ?? null,
    renders: (p.renders ?? []).map((r) => ({ name: r.name, size: r.size, modifiedAt: r.modifiedAt, url: r.url })),
  };
}

export class Content2VideoEngine implements VideoEngine {
  readonly id: EngineId = 'content2video';
  readonly label = 'Content2Video (URL → Vídeo)';
  readonly capabilities = CAPABILITIES;

  private async engine(): Promise<RunningEngine> {
    return ensureEngineProcess();
  }

  private async call<T>(pathname: string, init?: RequestInit): Promise<T> {
    const { baseUrl } = await this.engine();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${pathname}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      });
    } catch (e) {
      throw new EngineNotAvailableError(`falha ao falar com o motor content2video: ${(e as Error).message}`);
    }
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new EngineError(
        String(payload.error ?? `HTTP ${res.status} em ${pathname}`),
        'ENGINE_HTTP',
        res.status,
      );
    }
    return payload as T;
  }

  async health(): Promise<EngineHealth> {
    let cfg: Record<string, unknown> = {};
    let available = false;
    let message = 'motor não iniciado';
    try {
      cfg = await this.call<Record<string, unknown>>('/api/config');
      available = true;
      message = String(cfg.authMessage ?? 'motor no ar');
    } catch (e) {
      message = (e as Error).message;
    }
    const ready = available && cfg.authReady === true;
    return {
      id: this.id,
      available,
      ready,
      message,
      version: typeof cfg.version === 'string' ? cfg.version : undefined,
      checks: [
        { name: 'processo do motor', ok: available, detail: available ? 'respondendo' : message, required: true },
        {
          name: `provedor de IA (${String(cfg.authLabel ?? 'Codex/OpenAI')})`,
          ok: ready,
          detail: String(cfg.authMessage ?? 'sem status'),
          required: true,
        },
      ],
    };
  }

  async config(): Promise<EngineConfigInfo> {
    const c = await this.call<Record<string, any>>('/api/config');
    return {
      language: c.language,
      voiceId: c.voiceId,
      aspectRatio: asAspect(c.aspectRatio),
      resolution: c.resolution,
      targetDuration: c.targetDuration,
      minimumQuality: c.minimumQuality,
      defaultVisualPresetId: c.defaultVisualPresetId,
      visualPresets: c.visualPresets ?? [],
      conversationStyles: c.conversationStyles ?? [],
      speechPaces: c.speechPaces ?? [],
    };
  }

  async createDirection(input: UrlToVideoInput): Promise<EngineJob> {
    const body = JSON.stringify({
      url: input.url,
      objective: input.objective ?? '',
      aspectRatio: input.aspectRatio,
      conversationStyle: input.conversationStyle,
      speechPace: input.speechPace,
      visualPresetId: input.visualPresetId,
      includeCta: input.includeCta,
    });
    const { job } = await this.call<{ job: RawJob }>('/api/jobs', { method: 'POST', body });
    return normalizeJob(job);
  }

  private async jobAction(pathname: string, body = '{}'): Promise<EngineJob> {
    const { job } = await this.call<{ job: RawJob }>(pathname, { method: 'POST', body });
    return normalizeJob(job);
  }

  approveDirection(jobId: string): Promise<EngineJob> {
    return this.jobAction(`/api/jobs/${encodeURIComponent(jobId)}/approve-visual`);
  }
  regenerateDirection(jobId: string): Promise<EngineJob> {
    return this.jobAction(`/api/jobs/${encodeURIComponent(jobId)}/regenerate-visual`);
  }
  cancelJob(jobId: string): Promise<EngineJob> {
    return this.jobAction(`/api/jobs/${encodeURIComponent(jobId)}/cancel`);
  }
  retryRender(jobId: string, mode: 'resume' | 'restart'): Promise<EngineJob> {
    return this.jobAction(`/api/jobs/${encodeURIComponent(jobId)}/retry`, JSON.stringify({ mode }));
  }

  async listJobs(): Promise<EngineJob[]> {
    const { jobs } = await this.call<{ jobs: RawJob[] }>('/api/jobs');
    return (jobs ?? []).map(normalizeJob);
  }

  async listProjects(): Promise<EngineProject[]> {
    const { projects } = await this.call<{ projects: RawProject[] }>('/api/projects');
    return (projects ?? []).map(normalizeProject);
  }

  editProject(slug: string, input: ProjectTransformInput): Promise<EngineJob> {
    return this.jobAction(`/api/projects/${encodeURIComponent(slug)}/edit`, JSON.stringify(input));
  }
  duplicateProject(slug: string, input: ProjectTransformInput): Promise<EngineJob> {
    return this.jobAction(`/api/projects/${encodeURIComponent(slug)}/duplicate`, JSON.stringify(input));
  }
  renderProject(slug: string, opts: { aspectRatio?: AspectRatio; includeCta?: boolean } = {}): Promise<EngineJob> {
    return this.jobAction(`/api/projects/${encodeURIComponent(slug)}/render`, JSON.stringify(opts));
  }

  async openEditor(slug: string): Promise<{ url: string }> {
    return this.call<{ url: string }>(`/api/projects/${encodeURIComponent(slug)}/preview`, { method: 'POST', body: '{}' });
  }

  async fetchMedia(relPath: string): Promise<{ status: number; contentType: string; body: NodeJS.ReadableStream }> {
    const { baseUrl } = await this.engine();
    const clean = relPath.replace(/^\/+/, '');
    const res = await fetch(`${baseUrl}/${clean}`);
    const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
    const body = res.body
      ? Readable.fromWeb(res.body as import('stream/web').ReadableStream)
      : Readable.from([]);
    return { status: res.status, contentType, body };
  }
}
