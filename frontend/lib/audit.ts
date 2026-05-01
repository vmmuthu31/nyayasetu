import { createHash } from "crypto";
import { prisma } from "./db";

const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function appendAuditLog({
  caseId,
  userId,
  event,
  details,
}: {
  caseId?: string;
  userId?: string;
  event: string;
  details?: Record<string, unknown>;
}) {
  const last = await prisma.auditLog.findFirst({
    orderBy: { sequence: "desc" },
    select: { hash: true, sequence: true },
  });

  const prevHash = last?.hash ?? GENESIS_HASH;
  const sequence = (last?.sequence ?? -1) + 1;
  const payload = JSON.stringify({ caseId, userId, event, details, sequence, prevHash, ts: Date.now() });
  const hash = sha256(payload);

  return prisma.auditLog.create({
    data: { caseId, userId, event, details, hash, prevHash, sequence },
  });
}

export async function verifyChain(): Promise<{ valid: boolean; brokenAt?: number }> {
  const logs = await prisma.auditLog.findMany({ orderBy: { sequence: "asc" } });

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : logs[i - 1].hash;
    if (log.prevHash !== expectedPrev) {
      return { valid: false, brokenAt: log.sequence };
    }
  }
  return { valid: true };
}
