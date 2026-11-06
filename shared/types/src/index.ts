export * as User from "./modules/user.js";

// Topic and Subtopic
export * from "./modules/topic.js";

// Argument
export * from "./modules/argument.js";

// Search
export * from "./modules/search.js";

// Argumentation scheme types and schemas
export {
  ArgumentStatusSchema,
  StatusUpdatePayloadSchema,
  ArgumentCreatedPayloadSchema,
  SchemeVariableTypeSchema,
  SchemeVariableSchema,
  CriticalQuestionSchema,
  SchemeSchema,
  SchemesRegistrySchema,
  loadAndValidateSchemes,
} from "./modules/argumentation.js";

export type {
  ArgumentStatus,
  StatusUpdatePayload,
  ArgumentCreatedPayload,
  SchemeVariableType,
  SchemeVariable,
  CriticalQuestion,
  Scheme,
  SchemesRegistry,
} from "./modules/argumentation.js";

// Render utility
export { renderArgumentText } from "./modules/render.js";

// Scheme data and helpers
export {
  schemes,
  getSchemeById,
  getCriticalQuestion,
  getValidResponseSchemes,
  getSchemesRegistry,
} from "./data/index.js";

export * from "./modules/admin.js";
