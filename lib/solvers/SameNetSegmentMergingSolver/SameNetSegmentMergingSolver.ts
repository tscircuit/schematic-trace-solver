import { BaseSolver } from "../BaseSolver/BaseSolver";
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver";
import type { Point } from "@tscircuit/math-utils";

export interface MergedTracePath extends SolvedTracePath {
  originalTracePaths: SolvedTracePath[];
}

export class SameNetSegmentMergingSolver extends BaseSolver {
  solvedTracePaths: SolvedTracePath[];
  mergedTracePaths: MergedTracePath[] = [];
  mergeThreshold: number;

  constructor(params: {
    solvedTracePaths: SolvedTracePath[];
    mergeThreshold?: number;
  }) {
    super();
    this.solvedTracePaths = params.solvedTracePaths;
    this.mergeThreshold = params.mergeThreshold ?? 0.5;
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetSegmentMergingSolver
  >[0] {
    return {
      solvedTracePaths: this.solvedTracePaths,
      mergeThreshold: this.mergeThreshold,
    };
  }

  override _step() {
    if (!this.solvedTracePaths || this.solvedTracePaths.length === 0) {
      this.mergedTracePaths = [];
      this.solved = true;
      return;
    }

    // Group traces by netId (using netId from the trace's netId property or from pins)
    const tracesByNet = new Map<string, SolvedTracePath[]>();

    for (const trace of this.solvedTracePaths) {
      // Try to get netId from different possible locations
      let netId: string | undefined = (trace as any).netId;

      if (!netId && (trace as any).pins && (trace as any).pins.length > 0) {
        // Try to infer netId from the first pin's connections
        netId = (trace as any).pins[0]?.netId;
      }

      if (!netId) {
        // Use a default group for traces without netId
        netId = "__ungrouped__";
      }

      if (!tracesByNet.has(netId)) {
        tracesByNet.set(netId, []);
      }
      tracesByNet.get(netId)!.push(trace);
    }

    // Process each net's traces
    const allMerged: MergedTracePath[] = [];
    for (const [netId, traces] of tracesByNet) {
      const merged = this.mergeTracesForNet(traces, netId);
      allMerged.push(...merged);
    }

    this.mergedTracePaths = allMerged;
    this.solved = true;
  }

  private mergeTracesForNet(
    traces: SolvedTracePath[],
    netId: string,
  ): MergedTracePath[] {
    if (traces.length <= 1) {
      return traces.map((t) => ({ ...t, originalTracePaths: [t] }));
    }

    // Extract all segments from all traces
    interface Segment {
      trace: SolvedTracePath;
      start: Point;
      end: Point;
      index: number;
      isHorizontal: boolean;
    }

    const allSegments: Segment[] = [];

    for (const trace of traces) {
      if (!trace.tracePath || trace.tracePath.length < 2) continue;
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const start = trace.tracePath[i];
        const end = trace.tracePath[i + 1];
        const isHorizontal = Math.abs(start.y - end.y) < 1e-9;
        allSegments.push({
          trace,
          start,
          end,
          index: i,
          isHorizontal,
        });
      }
    }

    if (allSegments.length === 0) {
      return traces.map((t) => ({ ...t, originalTracePaths: [t] }));
    }

    // Separate horizontal and vertical segments
    const horizontalSegments = allSegments.filter((s) => s.isHorizontal);
    const verticalSegments = allSegments.filter((s) => !s.isHorizontal);

    // Merge collinear segments
    const mergedHorizontal = this.mergeCollinearSegments(
      horizontalSegments,
      "horizontal",
    );
    const mergedVertical = this.mergeCollinearSegments(
      verticalSegments,
      "vertical",
    );

    // Combine merged segments
    const mergedSegments = [...mergedHorizontal, ...mergedVertical];

    // If no merging happened, return original traces
    if (mergedSegments.length === allSegments.length) {
      return traces.map((t) => ({ ...t, originalTracePaths: [t] }));
    }

    // Group merged segments back by original trace
    const traceMap = new Map<SolvedTracePath, Point[]>();
    for (const seg of mergedSegments) {
      if (!traceMap.has(seg.trace)) {
        traceMap.set(seg.trace, []);
      }
      const points = traceMap.get(seg.trace)!;
      if (points.length === 0) {
        points.push(seg.start, seg.end);
      } else {
        // Check if we need to append or prepend
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];

        if (this.pointsEqual(lastPoint, seg.start)) {
          points.push(seg.end);
        } else if (this.pointsEqual(lastPoint, seg.end)) {
          // Already have the end, skip
        } else if (this.pointsEqual(firstPoint, seg.end)) {
          points.unshift(seg.start);
        } else if (this.pointsEqual(firstPoint, seg.start)) {
          points.unshift(seg.end);
        } else {
          // Disconnected segment, add as new
          points.push(seg.start, seg.end);
        }
      }
    }

    // Deduplicate consecutive points
    for (const [trace, points] of traceMap) {
      const uniquePoints: Point[] = [];
      for (const point of points) {
        if (
          uniquePoints.length === 0 ||
          !this.pointsEqual(uniquePoints[uniquePoints.length - 1], point)
        ) {
          uniquePoints.push(point);
        }
      }
      traceMap.set(trace, uniquePoints);
    }

    // Create merged trace paths
    const result: MergedTracePath[] = [];
    for (const [originalTrace, mergedPoints] of traceMap) {
      if (mergedPoints.length >= 2) {
        result.push({
          ...originalTrace,
          tracePath: mergedPoints,
          originalTracePaths: [originalTrace],
        });
      } else {
        result.push({
          ...originalTrace,
          originalTracePaths: [originalTrace],
        });
      }
    }

    return result;
  }

  private mergeCollinearSegments(
    segments: {
      trace: SolvedTracePath;
      start: Point;
      end: Point;
      index: number;
      isHorizontal: boolean;
    }[],
    orientation: "horizontal" | "vertical",
  ): typeof segments {
    if (segments.length <= 1) return segments;

    // Group by the fixed coordinate (Y for horizontal, X for vertical)
    const groups = new Map<number, typeof segments>();

    for (const seg of segments) {
      const key = orientation === "horizontal" ? seg.start.y : seg.start.x;
      // Round to avoid floating point issues
      const roundedKey = Math.round(key * 1000) / 1000;
      if (!groups.has(roundedKey)) {
        groups.set(roundedKey, []);
      }
      groups.get(roundedKey)!.push(seg);
    }

    const merged: typeof segments = [];

    for (const [_, group] of groups) {
      // Sort by the varying coordinate
      const sorted = [...group].sort((a, b) => {
        const aStart = orientation === "horizontal" ? a.start.x : a.start.y;
        const bStart = orientation === "horizontal" ? b.start.x : b.start.y;
        return aStart - bStart;
      });

      // Merge overlapping or close segments
      let current = { ...sorted[0] };

      for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        const currentEnd =
          orientation === "horizontal" ? current.end.x : current.end.y;
        const nextStart =
          orientation === "horizontal" ? next.start.x : next.start.y;

        if (nextStart - currentEnd <= this.mergeThreshold) {
          // Merge: extend current to next's end
          if (orientation === "horizontal") {
            current.end = {
              ...current.end,
              x: Math.max(current.end.x, next.end.x),
            };
          } else {
            current.end = {
              ...current.end,
              y: Math.max(current.end.y, next.end.y),
            };
          }
          // Also extend start if needed
          const currentStart =
            orientation === "horizontal" ? current.start.x : current.start.y;
          const nextStartVal =
            orientation === "horizontal" ? next.start.x : next.start.y;
          if (nextStartVal < currentStart) {
            if (orientation === "horizontal") {
              current.start = { ...current.start, x: nextStartVal };
            } else {
              current.start = { ...current.start, y: nextStartVal };
            }
          }
        } else {
          merged.push(current);
          current = { ...next };
        }
      }
      merged.push(current);
    }

    return merged;
  }

  private pointsEqual(p1: Point, p2: Point, tolerance: number = 1e-9): boolean {
    return (
      Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance
    );
  }

  override visualize() {
    return { lines: [], circles: [], rects: [], points: [], texts: [] };
  }
}
