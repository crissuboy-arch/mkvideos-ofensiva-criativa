// Serviço da funcionalidade URL → Vídeo. Camada única usada pelo painel e pela CLI.
// Junta defaults + validação + seleção de motor. Não conhece HTTP nem argv.

import '../engines/content2video/index.js'; // registra o motor content2video
import { getEngine } from '../engines/registry.js';
import type {
  EngineHealth, EngineJob, EngineProject, EngineConfigInfo, VideoEngine,
} from '../engines/types.js';
import { loadDefaults } from './config.js';
import { normalizeRequest, normalizeTransform } from './validate.js';
import type { Url2VideoDefaults, Url2VideoRequestRaw } from './types.js';

export interface Url2VideoStatus {
  engine: string;
  defaults: Url2VideoDefaults;
  health: EngineHealth;
  config: EngineConfigInfo | null;
}

export class Url2VideoService {
  private readonly defaults: Url2VideoDefaults;

  constructor(
    private readonly engineResolver: () => VideoEngine = () => getEngine(loadDefaults().engine),
    defaults?: Url2VideoDefaults,
  ) {
    this.defaults = defaults ?? loadDefaults();
  }

  private engine(): VideoEngine {
    return this.engineResolver();
  }

  getDefaults(): Url2VideoDefaults {
    return { ...this.defaults };
  }

  async status(): Promise<Url2VideoStatus> {
    const engine = this.engine();
    const health = await engine.health();
    let config: EngineConfigInfo | null = null;
    if (health.available) {
      config = await engine.config().catch(() => null);
    }
    return { engine: engine.id, defaults: this.getDefaults(), health, config };
  }

  /** Passo 1: analisa a URL e prepara direção visual + cena-piloto (gate). */
  async start(raw: Url2VideoRequestRaw): Promise<EngineJob> {
    return this.engine().createDirection(normalizeRequest(raw, this.defaults));
  }

  approve(jobId: string): Promise<EngineJob> {
    return this.engine().approveDirection(jobId);
  }
  regenerate(jobId: string): Promise<EngineJob> {
    return this.engine().regenerateDirection(jobId);
  }
  cancel(jobId: string): Promise<EngineJob> {
    return this.engine().cancelJob(jobId);
  }
  retry(jobId: string, mode: 'resume' | 'restart'): Promise<EngineJob> {
    return this.engine().retryRender(jobId, mode);
  }

  listJobs(): Promise<EngineJob[]> {
    return this.engine().listJobs();
  }
  listProjects(): Promise<EngineProject[]> {
    return this.engine().listProjects();
  }

  async edit(slug: string, raw: Parameters<typeof normalizeTransform>[0]): Promise<EngineJob> {
    return this.engine().editProject(slug, normalizeTransform(raw, this.defaults));
  }
  async duplicate(slug: string, raw: Parameters<typeof normalizeTransform>[0]): Promise<EngineJob> {
    return this.engine().duplicateProject(slug, normalizeTransform(raw, this.defaults));
  }
  render(slug: string): Promise<EngineJob> {
    return this.engine().renderProject(slug);
  }
  openEditor(slug: string): Promise<{ url: string }> {
    return this.engine().openEditor(slug);
  }
  fetchMedia(relPath: string): ReturnType<VideoEngine['fetchMedia']> {
    return this.engine().fetchMedia(relPath);
  }
}

let singleton: Url2VideoService | null = null;
/** Instância compartilhada (painel + CLI no mesmo processo). */
export function url2video(): Url2VideoService {
  singleton ??= new Url2VideoService();
  return singleton;
}
