import { idbGet, idbPut } from "./idb";
import type { SigningPlanStep } from "@folio/engine/signing";

type SigningPlanRecord = { id: string; steps: SigningPlanStep[] };

/** A local checklist of who still needs to sign a document, in order. */
export async function getSigningPlan(documentId: string): Promise<SigningPlanStep[]> {
  const record = await idbGet<SigningPlanRecord>("signingplans", documentId);
  return record?.steps ?? [];
}

export async function setSigningPlan(documentId: string, steps: SigningPlanStep[]): Promise<void> {
  await idbPut("signingplans", { id: documentId, steps });
}
