// Serviço "Legendar": enviar vídeo → transcrever → revisar/editar/sincronizar →
// escolher estilo → exportar SRT → queimar no vídeo → MP4 final legendado.
//
// REUSO (em vez de duplicar pipeline):
//  - transcrição real = adapter otimizevideo (fase `transcrever`, com o gate de
//    custo dele quando o provider é pago — ex.: groq).
//  - queima de legenda = src/video/ffmpeg.ts (técnica referida de videosub).
//  - duração/validação = src/audio/probe.ts (ffprobeDuration), já existente.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { OtimizevideoService } from '../otimizevideo/service.js';
import { burnSubtitles, muxSoftSubtitles, type SubtitleStyle } from '../video/ffmpeg.js';
import { LegendaStore, type LegendaProject } from './store.js';
import { VideoImporter } from './import.js';
import { buildTranscribePlan, type TranscribePlan } from './transcribe-plan.js';
import { wordsToCues, shiftCues, cuesToSrt, type Cue, type Transcript } from './srt.js';

export interface TranscribeOptions {
  provider?: string;   // groq | whisper_local | whisperx
  confirmed?: boolean;  // gate de custo do otimizevideo (groq é pago)
  maxChars?: number;
  maxDur?: number;
}

export class LegendasService {
  private readonly store: LegendaStore;
  private readonly otv: OtimizevideoService;
  private readonly importer: VideoImporter;
  private readonly planBuilder: typeof buildTranscribePlan;

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    deps: {
      store?: LegendaStore;
      otv?: OtimizevideoService;
      importer?: VideoImporter;
      planBuilder?: typeof buildTranscribePlan;
    } = {},
  ) {
    this.store = deps.store ?? new LegendaStore(env);
    this.otv = deps.otv ?? new OtimizevideoService(env);
    this.importer = deps.importer ?? new VideoImporter(env);
    this.planBuilder = deps.planBuilder ?? buildTranscribePlan;
  }

  list(): LegendaProject[] { return this.store.list(); }
  get(id: string): LegendaProject | null { return this.store.get(id); }
  cues(id: string): Cue[] { return this.store.readCues(id); }
  srtText(id: string): string { return cuesToSrt(this.store.readCues(id)); }
  srtPath(id: string): string { return this.store.srtPath(id); }

  /** Passo 1: registrar o vídeo enviado. */
  create(videoPath: string, title?: string): LegendaProject {
    if (!existsSync(videoPath)) throw new Error(`vídeo não encontrado: ${videoPath}`);
    return this.store.create(videoPath, title);
  }

  /**
   * Passo 1 (A) — arquivo do computador: recebe o binário do vídeo (stream),
   * salva com nome seguro numa pasta de trabalho do MKVideos e cria o projeto.
   */
  async createFromUpload(
    source: NodeJS.ReadableStream, originalName: string, title?: string, declaredBytes?: number,
  ): Promise<LegendaProject> {
    const { path: videoPath } = await this.importer.saveUpload(source, originalName, declaredBytes);
    return this.create(videoPath, title);
  }

  /**
   * Passo 1 (B) — link do YouTube: baixa o vídeo com yt-dlp para a pasta de
   * trabalho e cria o projeto (usa o título do vídeo quando não vier um).
   */
  async createFromYoutube(url: string, title?: string): Promise<LegendaProject> {
    const { path: videoPath, title: ytTitle } = await this.importer.fromYoutube(url);
    return this.create(videoPath, title || ytTitle);
  }

  /**
   * Passo 2 (pré): descreve as opções de transcrição para a UI — provedor,
   * local/grátis vs. pago, duração do vídeo e custo estimado. NÃO executa nada
   * nem gasta: é só o "plano" mostrado antes de o usuário escolher.
   */
  async transcribePlan(id: string): Promise<TranscribePlan> {
    const project = this.store.get(id);
    if (!project) throw new Error(`projeto "${id}" não existe.`);
    return this.planBuilder(project.sourceVideo, this.env);
  }

  /** Passo 2: transcrever o vídeo (ASR) e gerar as legendas iniciais. */
  async transcribe(id: string, opts: TranscribeOptions = {}): Promise<{ project: LegendaProject; cues: Cue[] }> {
    const project = this.store.get(id);
    if (!project) throw new Error(`projeto "${id}" não existe.`);
    const provider = opts.provider ?? 'groq';

    const ingest = await this.otv.ingest(project.sourceVideo);
    const otvId = ingest.id;
    if (!otvId) throw new Error(`otimizevideo ingest não retornou um id (stderr: ${ingest.stderr.slice(0, 200)}).`);

    // O gate de custo vive no OtimizevideoService.transcrever (groq é pago).
    const t = await this.otv.transcrever(otvId, provider, opts.confirmed ?? false);
    if (t.code !== 0) throw new Error(`transcrição falhou (código ${t.code}): ${t.stderr.slice(0, 300)}`);

    const transcriptFile = path.join(this.otv.dirDo(otvId), 'transcript.json');
    if (!existsSync(transcriptFile)) throw new Error('transcript.json não foi produzido.');
    const transcript = JSON.parse(readFileSync(transcriptFile, 'utf-8')) as Transcript;

    const cues = wordsToCues(transcript.palavras, {
      maxChars: opts.maxChars, maxDur: opts.maxDur, segmentEnds: transcript.fins_segmento,
    });
    this.store.saveCues(id, cues);
    const project2 = this.store.update(id, {
      otvId, transcriptProvider: `${provider}${transcript.provedor ? ` (${transcript.provedor})` : ''}`,
      idioma: transcript.idioma, cueCount: cues.length,
    });
    return { project: project2, cues };
  }

  /** Editar as legendas (texto/tempo) — revisão manual. */
  setCues(id: string, cues: Cue[]): LegendaProject {
    this.store.saveCues(id, cues);
    return this.store.update(id, { burnedVideoPath: undefined, softSubVideoPath: undefined });
  }

  /** Sincronizar: deslocar todas as legendas por N segundos (pode ser negativo). */
  shift(id: string, deltaSeconds: number): Cue[] {
    const cues = shiftCues(this.store.readCues(id), deltaSeconds);
    this.store.saveCues(id, cues);
    this.store.update(id, { burnedVideoPath: undefined, softSubVideoPath: undefined });
    return cues;
  }

  setStyle(id: string, style: SubtitleStyle): LegendaProject {
    return this.store.update(id, { style });
  }

  /** Queimar a legenda no vídeo (hard subs) → MP4 final. Local, sem custo. */
  async burn(id: string, opts: { width?: number; height?: number; style?: SubtitleStyle } = {}): Promise<LegendaProject> {
    const project = this.store.get(id);
    if (!project) throw new Error(`projeto "${id}" não existe.`);
    if (this.store.readCues(id).length === 0) throw new Error('não há legendas — transcreva ou edite primeiro.');
    const output = path.join(this.store.dir(id), 'final-legendado.mp4');
    await burnSubtitles({
      input: project.sourceVideo,
      srt: this.store.srtPath(id),
      output,
      width: opts.width,
      height: opts.height,
      style: opts.style ?? project.style,
      env: this.env,
    });
    return this.store.update(id, { burnedVideoPath: output, style: opts.style ?? project.style });
  }

  /** Exportar a legenda como faixa selecionável (soft subs), sem re-encode. */
  async softSub(id: string): Promise<LegendaProject> {
    const project = this.store.get(id);
    if (!project) throw new Error(`projeto "${id}" não existe.`);
    const output = path.join(this.store.dir(id), 'com-legenda-selecionavel.mp4');
    await muxSoftSubtitles({ input: project.sourceVideo, srt: this.store.srtPath(id), output, env: this.env });
    return this.store.update(id, { softSubVideoPath: output });
  }
}

let singleton: LegendasService | null = null;
export function legendas(): LegendasService {
  singleton ??= new LegendasService();
  return singleton;
}
