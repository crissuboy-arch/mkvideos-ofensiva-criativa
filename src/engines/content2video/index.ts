// Registro do motor content2video.

import { registerEngine } from '../registry.js';
import { Content2VideoEngine } from './engine.js';

registerEngine('content2video', () => new Content2VideoEngine());

export { Content2VideoEngine } from './engine.js';
export { ensureEngineProcess, stopEngineProcess, currentBaseUrl } from './process.js';
export { loadC2VConfig, moduleRoot } from './config.js';
