/**
 * cookedPrompts — Rewrite/Template System Module Boundary
 */

export type {
  GuidanceSeverity,
  GuidanceDimension,
  TemplateCategoryTag,
  RewriteInput,
  GuidanceItem,
  RewriteSuggestion,
  PromptTemplate,
  TemplateSuggestion,
  RewriteEngineOptions,
} from './types.js';

export { REWRITE_ENGINE_VERSION, generateRewriteSuggestion } from './rewrite-engine.js';
export { TEMPLATE_GENERATOR_VERSION, generateTemplateSuggestion } from './template-generator.js';
export { TEMPLATE_CATALOG, getTemplateCatalog } from './template-catalog.js';
