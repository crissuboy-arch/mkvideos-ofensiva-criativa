// Barrel da funcionalidade URL → Vídeo.

import '../engines/index.js'; // registra os motores

export { Url2VideoService, url2video } from './service.js';
export type { Url2VideoStatus } from './service.js';
export { loadDefaults, normalizeAspect, normalizeStyle, normalizePace } from './config.js';
export { normalizeRequest, normalizeTransform, validateUrl } from './validate.js';
export { Url2VideoValidationError } from './types.js';
export type { Url2VideoDefaults, Url2VideoRequest, Url2VideoRequestRaw } from './types.js';
