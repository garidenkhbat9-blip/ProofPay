export interface EvidenceSnapshot {
  p_submission_id: string;
  p_notes: string;
  p_artifacts: Record<string, unknown>[];
}

/** Keep a finalize request intact if its response is lost after DB commit. */
export function createEvidenceFinalizer() {
  let pending: EvidenceSnapshot | null = null;
  let confirmed = false;
  return {
    get pending() { return pending; },
    async submit(
      snapshot: EvidenceSnapshot,
      send: (snapshot: EvidenceSnapshot) => Promise<unknown>,
    ) {
      pending ??= structuredClone(snapshot);
      if (confirmed) return;
      await send(pending);
      confirmed = true;
    },
  };
}
