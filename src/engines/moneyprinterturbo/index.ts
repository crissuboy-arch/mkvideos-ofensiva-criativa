// Registro do motor moneyprinterturbo (adicional; o default continua 'content2video').

import { registerEngine } from '../registry.js';
import { MoneyPrinterTurboEngine } from './engine.js';

registerEngine('moneyprinterturbo', () => new MoneyPrinterTurboEngine());

export { MoneyPrinterTurboEngine } from './engine.js';
export { MPT_PHASES, type MptThemeInput } from './engine.js';
export {
  loadMptConfig, submitMptVideo, getMptTaskStatus, pollMptTask, cancelMptTask,
  getMptTaskVideoUrls, downloadMptArtifact, buildMptPtBrVerticalRequest,
  MPT_TASK_STATE, isTerminalMptState,
  type MptConfig, type MptVideoRequest, type MptTaskStatus,
} from './client.js';
