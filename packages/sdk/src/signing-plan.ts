import { createId } from "./document-model";

export type SigningPlanStep = { id: string; name: string; role?: string };

/** Models a local checklist of who still needs to sign a document, in order. */
export function newSigningStep(name: string, role?: string): SigningPlanStep {
  return { id: createId(), name, role };
}
