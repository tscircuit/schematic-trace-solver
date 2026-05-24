import type { Point } from "@tscircuit/math-utils";
import { BaseSolver } from "../BaseSolver/BaseSolver";
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver";

/**
 * SameNetTraceMergeSolver — pipeline phase that merges close same-net trace
 * segments on the same axis (collinear same-X or same-Y).
 *
 * Finds all traces belonging to the same electrical net (via userNetId,
 * globalConnNetId, or dcConnNetId), then merges pairs where the gap between
 * endpoints on their shared axis is below `mergeThreshold`.
 *
 * Inserted after TraceCleanupSolver in SchematicTracePipelineSolver.
 */

const MERGE_THRESHOLD = 0.1; // mm — max gap on shared axis to consider merging

function netKey(trace: SolvedTracePath): string {
  // userNetId takes priority, then globalConnNetId, then dcConnNetId
  if (trace.userNetId && trace.userNetId.length > 0) return trace.userNetId;
  if (trace.globalConnNetId && trace.globalConnNetId.length > 0)
    return trace.globalConnNetId;
  return trace.dcConnNetId ?? "";
}

function dist2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function removeDupes(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (
      !prev ||
      Math.abs(prev.x - p.x) > 1e-9 ||
      Math.abs(prev.y - p.y) > 1e-9
    ) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Try to merge two same-net traces. Returns merged trace or null.
 */
function tryMerge(
  a: SolvedTracePath,
  b: SolvedTracePath,
  threshold: number,
): SolvedTracePath | null {
  const pa = a.tracePath;
  const pb = b.tracePath;
  if (!pa?.length || !pb?.length) return null;

  const aS = pa[0]!;
  const aE = pa[pa.length - 1]!;
  const bS = pb[0]!;
  const bE = pb[pb.length - 1]!;

  // Check all 4 endpoint pairing options
  const options = [
    { d2: dist2(aE, bS), ra: false, rb: false },
    { d2: dist2(aE, bE), ra: false, rb: true },
    { d2: dist2(aS, bS), ra: true, rb: false },
    { d2: dist2(aS, bE), ra: true, rb: true },
  ];

  const best = options.reduce((p, c) => (c.d2 < p.d2 ? c : p));
  if (best.d2 > threshold * threshold) return null;

  const pathA = best.ra ? [...pa].reverse() : pa;
  const pathB = best.rb ? [...pb].reverse() : pb;

  const from = pathA[pathA.length - 1]!;
  const to = pathB[0]!;

  // Insert an L-bridge if not already axis-aligned
  const bridge: Point[] =
    Math.abs(from.x - to.x) > 1e-9 && Math.abs(from.y - to.y) > 1e-9
      ? [{ x: to.x, y: from.y }]
      : [];

  return {
    ...a,
    mspPairId: `merged:${a.mspPairId}+${b.mspPairId}`,
    tracePath: removeDupes([...pathA, ...bridge, ...pathB]),
    mspConnectionPairIds: [
      ...a.mspConnectionPairIds,
      ...b.mspConnectionPairIds,
    ],
    pinIds: [...a.pinIds, ...b.pinIds],
  };
}

export class SameNetTraceMergeSolver extends BaseSolver {
  private readonly inputTraces: SolvedTracePath[];
  outputTraces: SolvedTracePath[];
  mergeCount = 0;

  constructor({
    traces,
    mergeThreshold = MERGE_THRESHOLD,
  }: {
    traces: SolvedTracePath[];
    mergeThreshold?: number;
  }) {
    super();
    this.inputTraces = [...traces];
    this.outputTraces = [...traces];
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces };
  }

  override _step(): void {
    // Build net groups
    const byNet = new Map<string, SolvedTracePath[]>();
    for (const t of this.outputTraces) {
      const k = netKey(t);
      const g = byNet.get(k);
      if (g) g.push(t);
      else byNet.set(k, [t]);
    }

    let merged = false;

    for (const group of byNet.values()) {
      if (group.length < 2) continue;

      // O(n²) scan per net
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const result = tryMerge(group[i]!, group[j]!, MERGE_THRESHOLD);
          if (result) {
            this.outputTraces = this.outputTraces.filter(
              (t) =>
                t.mspPairId !== group[i]!.mspPairId &&
                t.mspPairId !== group[j]!.mspPairId,
            );
            this.outputTraces.push(result);
            this.mergeCount++;
            merged = true;
            return;
          }
        }
      }
    }

    if (!merged) {
      this.solved = true;
    }
  }
}
