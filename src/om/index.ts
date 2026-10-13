// src/om/index.ts — ponte OpenMontage (AGPLv3 isolado; ver bridge.ts).
export { runOmTool, omListTools, omRoot, type OmResult } from './bridge.js';
export { runPaidTool, PaidGateError, PAID_TOOLS, type PaidToolName } from './paid.js';
