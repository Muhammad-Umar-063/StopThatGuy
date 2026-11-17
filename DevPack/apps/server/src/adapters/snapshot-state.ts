import { schema, t } from "@colyseus/schema";
import type { AuthoritativeSnapshot } from "@stopthatguy/shared";

/**
 * T006's reconstructable transport envelope. The JSON is exactly the shared snapshot,
 * not a parallel set of gameplay types. No world geometry or private session data.
 * T014 can decode snapshotJson on state change. Full-snapshot bandwidth is deliberately
 * unoptimized at this stage; measure before replacing it with per-entity schema deltas.
 */
export class SnapshotState extends schema({ snapshotJson: t.string().default("") }) {
  publish(snapshot: AuthoritativeSnapshot): void {
    this.snapshotJson = JSON.stringify(snapshot);
  }
}
