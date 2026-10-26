import { idbGet, idbGetAll, idbPut } from "./idb";
import type { AuditEvent, AuditEventType } from "@folio/engine";

type AuditTrailRecord = { id: string; fileName: string; events: AuditEvent[] };

export async function logAuditEvent(
  documentId: string,
  fileName: string,
  type: AuditEventType,
  detail: string,
  actor?: string
): Promise<void> {
  const existing = (await idbGet<AuditTrailRecord>("auditlog", documentId)) ?? {
    id: documentId,
    fileName,
    events: [],
  };
  existing.events.push({ id: crypto.randomUUID(), timestamp: Date.now(), type, detail, actor });
  await idbPut("auditlog", existing);
}

export async function getAuditTrail(documentId: string): Promise<AuditEvent[]> {
  const record = await idbGet<AuditTrailRecord>("auditlog", documentId);
  return record?.events ?? [];
}

export type ActivityEntry = AuditEvent & { fileName: string };

/**
 * Flattens every document's audit trail into one reverse-chronological feed, for Home's "Recent activity".
 */
export async function getRecentActivityAcrossDocuments(limit: number): Promise<ActivityEntry[]> {
  const records = await idbGetAll<AuditTrailRecord>("auditlog");
  const flattened: ActivityEntry[] = records.flatMap((r) => r.events.map((e) => ({ ...e, fileName: r.fileName })));
  return flattened.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}
