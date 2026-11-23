import schemesJson from "./schemes.json" with { type: "json" };
import { loadAndValidateSchemes } from "../modules/argumentation.js";
import type { Scheme, SchemesRegistry } from "../modules/argumentation.js";

export const schemes: SchemesRegistry = loadAndValidateSchemes(schemesJson);

export const getSchemeById = (id: string): Scheme | undefined =>
  schemes.schemes.find((s) => s.id === id);

export const getCriticalQuestion = (schemeId: string, cqId: string) =>
  getSchemeById(schemeId)?.criticalQuestions.find((cq) => cq.id === cqId);

export const getValidResponseSchemes = (schemeId: string, cqId: string): Scheme[] => {
  const cq = getCriticalQuestion(schemeId, cqId);
  if (!cq) return [];
  if (cq.validResponseSchemeIds.length === 0) return schemes.schemes;
  return schemes.schemes.filter((s) => cq.validResponseSchemeIds.includes(s.id));
};

export const getSchemesRegistry = (): SchemesRegistry => schemes;
