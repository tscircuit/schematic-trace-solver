import type { GraphicsObject } from "graphics-debug";
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver";
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver";
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver";
import { applyJogToTerminalSegment } from "./applyJogToTrace";

type ConnNetId = string;

export interface OverlappingTraceSegmentLocator {
  connNetId: string;
  pathsWithOverlap: Array<{
    solvedTracePathIndex: number;
    traceSegmentIndex: number;
  }>;
}

export class TraceOverlapIssueSolver extends BaseSolver {
  overlappingTraceSegments: OverlappingTraceSegmentLocator[];
  traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>;

  SHIFT_DISTANCE = 0.1;

  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {};

  constructor(params: {
    overlappingTraceSegments: OverlappingTraceSegmentLocator[];
    traceNetIslands: Record<ConnNetId, Array<SolvedTracePath>>;
  }) {
    super();
    this.overlappingTraceSegments = params.overlappingTraceSegments;
    this.traceNetIslands = params.traceNetIslands;

    // Only add the relevant traces to the correctedTraceMap
    for (const { connNetId, pathsWithOverlap } of this
      .overlappingTraceSegments) {
      for (const {
        solvedTracePathIndex,
        traceSegmentIndex,
      } of pathsWithOverlap) {
        const mspPairId =
          this.traceNetIslands[connNetId][solvedTracePathIndex].mspPairId;
        this.correctedTraceMap[mspPairId] =
          this.traceNetIslands[connNetId][solvedTracePathIndex];
      }
    }
  }

  override _step() {
    // Shift only the overlapping segments, and move the shared endpoints
    // (the last point of the previous segment and the first point of the next
    // segment) so the polyline remains orthogonal without self-overlap.
    const EPS = 1e-6;

    const eq = (a: number, b: number) => Math.abs(a - b) < EPS;
    const samePoint = (
      p: { x: number; y: number } | undefined,
      q: { x: number; y: number } | undefined
    ) => !!p && !!q && eq(p.x, q.x) && eq(p.y, q.y);

    // Helper: intersection between orthogonal segments
    const orthogonalSegmentsIntersect = (
      a1: { x: number; y: number },
      a2: { x: number; y: number },
      b1: { x: number; y: number },
      b2: { x: number; y: number }
    ): boolean => {
      const aVert = Math.abs(a1.x - a2.x) < EPS;
      const aHorz = Math.abs(a1.y - a2.y) < EPS;
      const bVert = Math.abs(b1.x - b2.x) < EPS;
      const bHorz = Math.abs(b1.y - b2.y) < EPS;
      if ((!aVert && !aHorz) || (!bVert && !bHorz)) return false;

      if (aVert && bHorz) {
        const x = a1.x;
        const y = b1.y;
        const aMinY = Math.min(a1.y, a2.y);
        const aMaxY = Math.max(a1.y, a2.y);
        const bMinX = Math.min(b1.x, b2.x);
        const bMaxX = Math.max(b1.x, b2.x);
        return (
          x >= bMinX - EPS &&
          x <= bMaxX + EPS &&
          y >= aMinY - EPS &&
          y <= aMaxY + EPS
        );
      }
      if (aHorz && bVert) {
        const x = b1.x;
        const y = a1.y;
        const bMinY = Math.min(b1.y, b2.y);
        const bMaxY = Math.max(b1.y, b2.y);
        const aMinX = Math.min(a1.x, a2.x);
        const aMaxX = Math.max(a1.x, a2.x);
        return (
          x >= aMinX - EPS &&
          x <= aMaxX + EPS &&
          y >= bMinY - EPS &&
          y <= bMaxY + EPS
        );
      }

      // Collinear overlap on same orientation
      if (aVert && bVert && Math.abs(a1.x - b1.x) < EPS) {
        const aMinY = Math.min(a1.y, a2.y);
        const aMaxY = Math.max(a1.y, a2.y);
        const bMinY = Math.min(b1.y, b2.y);
        const bMaxY = Math.max(b1.y, b2.y);
        return Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY) > EPS;
      }
      if (aHorz && bHorz && Math.abs(a1.y - b1.y) < EPS) {
        const aMinX = Math.min(a1.x, a2.x);
        const aMaxX = Math.max(a1.x, a2.x);
        const bMinX = Math.min(b1.x, b2.x);
        const bMaxX = Math.max(b1.x, b2.x);
        return Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX) > EPS;
      }
      return false;
    };

    const countCrossingsBetweenPaths = (
      pathA: { x: number; y: number }[],
      pathB: { x: number; y: number }[]
    ): number => {
      let c = 0;
      for (let i = 0; i < pathA.length - 1; i++) {
        for (let j = 0; j < pathB.length - 1; j++) {
          if (
            orthogonalSegmentsIntersect(
              pathA[i]!,
              pathA[i + 1]!,
              pathB[j]!,
              pathB[j + 1]!
            )
          ) {
            c++;
          }
        }
      }
      return c;
    };

    // Build magnitude schedule per group (same as previous, but sign to be chosen)
    const N = this.overlappingTraceSegments.length;
    const magnitudes = this.overlappingTraceSegments.map((_, idx) => {
      const n = Math.floor(idx / 2) + 1;
      return n * this.SHIFT_DISTANCE;
    });

    // Generate candidate sign combinations (limit N<=6)
    const useBruteForce = N <= 6;
    const startTime = Date.now();
    const TIME_LIMIT_MS = 30;

    const makeOffsetsFromBits = (bits: number): number[] => {
      const arr: number[] = new Array(N);
      for (let i = 0; i < N; i++) {
        const sign = (bits >> i) & 1 ? 1 : -1;
        arr[i] = sign * magnitudes[i]!;
      }
      return arr;
    };

    const applyOffsetsToMap = (offsets: number[]) => {
      const newMap: Record<
        MspConnectionPairId,
        { tracePath: { x: number; y: number }[] }
      > = {};
      const JOG_SIZE = this.SHIFT_DISTANCE;

      for (let gidx = 0; gidx < this.overlappingTraceSegments.length; gidx++) {
        const group = this.overlappingTraceSegments[gidx]!;
        const offset = offsets[gidx]!;

        const byPath: Map<number, Set<number>> = new Map();
        for (const loc of group.pathsWithOverlap) {
          if (!byPath.has(loc.solvedTracePathIndex))
            byPath.set(loc.solvedTracePathIndex, new Set());
          byPath.get(loc.solvedTracePathIndex)!.add(loc.traceSegmentIndex);
        }

        for (const [pathIdx, segIdxSet] of byPath) {
          const original = this.traceNetIslands[group.connNetId][pathIdx]!;
          const current =
            this.correctedTraceMap[original.mspPairId] ?? original;
          const pts = current.tracePath.map((p) => ({ ...p }));

          const segIdxsRev = Array.from(segIdxSet)
            .sort((a, b) => a - b)
            .reverse();

          for (const si of segIdxsRev) {
            if (si < 0 || si >= pts.length - 1) continue;
            if (si === 0 || si === pts.length - 2) {
              applyJogToTerminalSegment({
                pts,
                segmentIndex: si,
                offset,
                JOG_SIZE,
                EPS,
              });
            } else {
              const start = pts[si]!;
              const end = pts[si + 1]!;
              const isVertical = Math.abs(start.x - end.x) < EPS;
              const isHorizontal = Math.abs(start.y - end.y) < EPS;
              if (!isVertical && !isHorizontal) continue;
              if (isVertical) {
                start.x += offset;
                end.x += offset;
              } else {
                start.y += offset;
                end.y += offset;
              }
            }
          }

          // Clean duplicates
          const cleaned: typeof pts = [];
          for (const p of pts) {
            if (
              cleaned.length === 0 ||
              !samePoint(cleaned[cleaned.length - 1], p)
            )
              cleaned.push(p);
          }

          newMap[original.mspPairId] = { tracePath: cleaned };
        }
      }
      return newMap;
    };

    const scoreOffsets = (offsets: number[]): number => {
      // Apply to copies and count crossings across all nets (pairs)
      const newMap = applyOffsetsToMap(offsets);
      const paths: Array<{
        id: MspConnectionPairId;
        pts: { x: number; y: number }[];
      }> = [];
      for (const [id, v] of Object.entries(newMap))
        paths.push({ id: id as MspConnectionPairId, pts: v.tracePath });

      let score = 0;
      for (let i = 0; i < paths.length; i++) {
        for (let j = i + 1; j < paths.length; j++) {
          score += countCrossingsBetweenPaths(paths[i]!.pts, paths[j]!.pts);
          if (score > bestScore) return score; // prune
        }
      }
      return score;
    };

    // Default alternating (fallback)
    const alternatingOffsets = this.overlappingTraceSegments.map((_, idx) => {
      const n = Math.floor(idx / 2) + 1;
      const signed = idx % 2 === 0 ? -n : n;
      return signed * this.SHIFT_DISTANCE;
    });

    let bestOffsets = alternatingOffsets;
    let bestScore = Number.POSITIVE_INFINITY;

    if (useBruteForce) {
      const total = 1 << N;
      for (let mask = 0; mask < total; mask++) {
        if (Date.now() - startTime > TIME_LIMIT_MS) break;
        const candidate = makeOffsetsFromBits(mask);
        const s = scoreOffsets(candidate);
        if (s < bestScore) {
          bestScore = s;
          bestOffsets = candidate;
          if (bestScore === 0) break;
        }
      }
    }

    // Apply chosen offsets to real correctedTraceMap
    this.overlappingTraceSegments.forEach((group, gidx) => {
      const offset = bestOffsets[gidx]!;

      const byPath: Map<number, Set<number>> = new Map();
      for (const loc of group.pathsWithOverlap) {
        if (!byPath.has(loc.solvedTracePathIndex))
          byPath.set(loc.solvedTracePathIndex, new Set());
        byPath.get(loc.solvedTracePathIndex)!.add(loc.traceSegmentIndex);
      }

      for (const [pathIdx, segIdxSet] of byPath) {
        const original = this.traceNetIslands[group.connNetId][pathIdx]!;
        const current = this.correctedTraceMap[original.mspPairId] ?? original;
        const pts = current.tracePath.map((p) => ({ ...p }));

        const segIdxsRev = Array.from(segIdxSet)
          .sort((a, b) => a - b)
          .reverse();
        const JOG_SIZE = this.SHIFT_DISTANCE;

        for (const si of segIdxsRev) {
          if (si < 0 || si >= pts.length - 1) continue;
          if (si === 0 || si === pts.length - 2) {
            applyJogToTerminalSegment({
              pts,
              segmentIndex: si,
              offset,
              JOG_SIZE,
              EPS,
            });
          } else {
            const start = pts[si]!;
            const end = pts[si + 1]!;
            const isVertical = Math.abs(start.x - end.x) < EPS;
            const isHorizontal = Math.abs(start.y - end.y) < EPS;
            if (!isVertical && !isHorizontal) continue;
            if (isVertical) {
              start.x += offset;
              end.x += offset;
            } else {
              start.y += offset;
              end.y += offset;
            }
          }
        }

        const cleaned: typeof pts = [];
        for (const p of pts) {
          if (
            cleaned.length === 0 ||
            !samePoint(cleaned[cleaned.length - 1], p)
          )
            cleaned.push(p);
        }

        this.correctedTraceMap[original.mspPairId] = {
          ...current,
          tracePath: cleaned,
        };
      }
    });

    this.solved = true;
  }

  override visualize(): GraphicsObject {
    // Visualize overlapped segments and proposed corrections
    const graphics: GraphicsObject = {
      lines: [],
      points: [],
      rects: [],
      circles: [],
    };

    // Draw overlapped segments in red
    for (const group of this.overlappingTraceSegments) {
      for (const {
        solvedTracePathIndex,
        traceSegmentIndex,
      } of group.pathsWithOverlap) {
        const path =
          this.traceNetIslands[group.connNetId][solvedTracePathIndex]!;
        const segStart = path.tracePath[traceSegmentIndex]!;
        const segEnd = path.tracePath[traceSegmentIndex + 1]!;
        graphics.lines!.push({
          points: [segStart, segEnd],
          strokeColor: "red",
        });
      }
    }

    // Draw corrected traces (post-shift) in blue dashed
    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "blue",
        strokeDash: "4 2",
      });
    }

    return graphics;
  }
}
