// import { BaseSolver } from "../BaseSolver/BaseSolver";
// import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver";
// import type { Point } from "@tscircuit/math-utils";

// export interface MergedTracePath extends SolvedTracePath {
//   originalTracePaths: SolvedTracePath[];
// }

// export class SameNetSegmentMergingSolver extends BaseSolver {
//   solvedTracePaths: SolvedTracePath[];
//   mergedTracePaths: MergedTracePath[] = [];
//   mergeThreshold: number;
//   alignThreshold: number;

//   constructor(params: {
//     solvedTracePaths: SolvedTracePath[];
//     mergeThreshold?: number;
//     alignThreshold?: number;
//   }) {
//     super();
//     this.solvedTracePaths = params.solvedTracePaths;
//     this.mergeThreshold = params.mergeThreshold ?? 0.5;
//     this.alignThreshold = params.alignThreshold ?? 0.5;
//   }

//   override getConstructorParams(): ConstructorParameters<
//     typeof SameNetSegmentMergingSolver
//   >[0] {
//     return {
//       solvedTracePaths: this.solvedTracePaths,
//       mergeThreshold: this.mergeThreshold,
//       alignThreshold: this.alignThreshold,
//     };
//   }

//   override _step() {
//     if (!this.solvedTracePaths || this.solvedTracePaths.length === 0) {
//       this.mergedTracePaths = [];
//       this.solved = true;
//       return;
//     }

//     // Group traces by netId
//     const tracesByNet = new Map<string, SolvedTracePath[]>();

//     for (const trace of this.solvedTracePaths) {
//       let netId: string | undefined = (trace as any).netId;

//       if (!netId && (trace as any).pins && (trace as any).pins.length > 0) {
//         netId = (trace as any).pins[0]?.netId;
//       }

//       if (!netId) {
//         netId = "__ungrouped__";
//       }

//       if (!tracesByNet.has(netId)) {
//         tracesByNet.set(netId, []);
//       }
//       tracesByNet.get(netId)!.push(trace);
//     }

//     // Process each net's traces
//     const allMerged: MergedTracePath[] = [];
//     for (const [netId, traces] of tracesByNet) {
//       const merged = this.mergeTracesForNet(traces, netId);
//       allMerged.push(...merged);
//     }

//     this.mergedTracePaths = allMerged;
//     this.solved = true;
//   }

//   private mergeTracesForNet(
//     traces: SolvedTracePath[],
//     netId: string,
//   ): MergedTracePath[] {
//     if (traces.length <= 1) {
//       return traces.map((t) => ({ ...t, originalTracePaths: [t] }));
//     }

//     // Extract all segments from all traces
//     interface Segment {
//       trace: SolvedTracePath;
//       start: Point;
//       end: Point;
//       index: number;
//       isHorizontal: boolean;
//     }

//     const allSegments: Segment[] = [];

//     for (const trace of traces) {
//       if (!trace.tracePath || trace.tracePath.length < 2) continue;
//       for (let i = 0; i < trace.tracePath.length - 1; i++) {
//         const start = trace.tracePath[i];
//         const end = trace.tracePath[i + 1];
//         const isHorizontal = Math.abs(start.y - end.y) < 1e-9;
//         allSegments.push({
//           trace,
//           start,
//           end,
//           index: i,
//           isHorizontal,
//         });
//       }
//     }

//     if (allSegments.length === 0) {
//       return traces.map((t) => ({ ...t, originalTracePaths: [t] }));
//     }

//     // Separate horizontal and vertical segments
//     const horizontalSegments = allSegments.filter((s) => s.isHorizontal);
//     const verticalSegments = allSegments.filter((s) => !s.isHorizontal);

//     // First, merge collinear segments (end-to-end)
//     const mergedHorizontal = this.mergeCollinearSegments(
//       horizontalSegments,
//       "horizontal",
//     );
//     const mergedVertical = this.mergeCollinearSegments(
//       verticalSegments,
//       "vertical",
//     );

//     // Second, align parallel segments that are close to each other
//     const alignedHorizontal = this.alignParallelSegments(
//       mergedHorizontal,
//       "horizontal",
//     );
//     const alignedVertical = this.alignParallelSegments(
//       mergedVertical,
//       "vertical",
//     );

//     // Combine all segments
//     const alignedSegments = [...alignedHorizontal, ...alignedVertical];

//     // If no alignment happened, return merged traces
//     if (alignedSegments.length === allSegments.length) {
//       return this.rebuildTracesFromSegments(alignedSegments);
//     }

//     return this.rebuildTracesFromSegments(alignedSegments);
//   }

//   /**
//    * Align parallel segments that are within threshold distance
//    * For horizontal segments: align to same Y coordinate
//    * For vertical segments: align to same X coordinate
//    */
//   private alignParallelSegments(
//     segments: {
//       trace: SolvedTracePath;
//       start: Point;
//       end: Point;
//       index: number;
//       isHorizontal: boolean;
//     }[],
//     orientation: "horizontal" | "vertical",
//   ): typeof segments {
//     if (segments.length <= 1) return segments;

//     // Group segments by their position clusters
//     const clusters: typeof segments[] = [];
//     const used = new Set<number>();

//     for (let i = 0; i < segments.length; i++) {
//       if (used.has(i)) continue;

//       const cluster: typeof segments = [segments[i]];
//       used.add(i);

//       const getPos = (seg: typeof segments[0]) =>
//         orientation === "horizontal" ? seg.start.y : seg.start.x;

//       const currentPos = getPos(segments[i]);

//       for (let j = i + 1; j < segments.length; j++) {
//         if (used.has(j)) continue;

//         const otherPos = getPos(segments[j]);

//         // Check if segments are within threshold distance
//         if (Math.abs(currentPos - otherPos) <= this.alignThreshold) {
//           cluster.push(segments[j]);
//           used.add(j);
//         }
//       }

//       if (cluster.length > 0) {
//         clusters.push(cluster);
//       }
//     }

//     // Align each cluster to the median position
//     const alignedSegments = [...segments];

//     for (const cluster of clusters) {
//       if (cluster.length <= 1) continue;

//       // Calculate median position for alignment
//       const positions = cluster.map((seg) =>
//         orientation === "horizontal" ? seg.start.y : seg.start.x,
//       );
//       const sortedPositions = [...positions].sort((a, b) => a - b);
//       const medianPos =
//         sortedPositions[Math.floor(sortedPositions.length / 2)];

//       // Align all segments in cluster
//       for (const seg of cluster) {
//         const index = alignedSegments.findIndex(
//           (s) =>
//             s.trace === seg.trace &&
//             s.index === seg.index &&
//             s.start.x === seg.start.x &&
//             s.start.y === seg.start.y,
//         );

//         if (index !== -1) {
//           if (orientation === "horizontal") {
//             // Align Y coordinate
//             const yOffset = medianPos - seg.start.y;
//             alignedSegments[index] = {
//               ...alignedSegments[index],
//               start: { ...alignedSegments[index].start, y: medianPos },
//               end: { ...alignedSegments[index].end, y: medianPos },
//             };
//           } else {
//             // Align X coordinate
//             const xOffset = medianPos - seg.start.x;
//             alignedSegments[index] = {
//               ...alignedSegments[index],
//               start: { ...alignedSegments[index].start, x: medianPos },
//               end: { ...alignedSegments[index].end, x: medianPos },
//             };
//           }
//         }
//       }
//     }

//     return alignedSegments;
//   }

//   private mergeCollinearSegments(
//     segments: {
//       trace: SolvedTracePath;
//       start: Point;
//       end: Point;
//       index: number;
//       isHorizontal: boolean;
//     }[],
//     orientation: "horizontal" | "vertical",
//   ): typeof segments {
//     if (segments.length <= 1) return segments;

//     // Group by the fixed coordinate (Y for horizontal, X for vertical)
//     const groups = new Map<number, typeof segments>();

//     for (const seg of segments) {
//       const key = orientation === "horizontal" ? seg.start.y : seg.start.x;
//       const roundedKey = Math.round(key * 1000) / 1000;
//       if (!groups.has(roundedKey)) {
//         groups.set(roundedKey, []);
//       }
//       groups.get(roundedKey)!.push(seg);
//     }

//     const merged: typeof segments = [];

//     for (const [_, group] of groups) {
//       // Sort by the varying coordinate
//       const sorted = [...group].sort((a, b) => {
//         const aStart = orientation === "horizontal" ? a.start.x : a.start.y;
//         const bStart = orientation === "horizontal" ? b.start.x : b.start.y;
//         return aStart - bStart;
//       });

//       // Merge overlapping or close segments
//       let current = { ...sorted[0] };

//       for (let i = 1; i < sorted.length; i++) {
//         const next = sorted[i];
//         const currentEnd =
//           orientation === "horizontal" ? current.end.x : current.end.y;
//         const nextStart =
//           orientation === "horizontal" ? next.start.x : next.start.y;

//         if (nextStart - currentEnd <= this.mergeThreshold) {
//           // Merge: extend current to next's end
//           if (orientation === "horizontal") {
//             current.end = {
//               ...current.end,
//               x: Math.max(current.end.x, next.end.x),
//             };
//           } else {
//             current.end = {
//               ...current.end,
//               y: Math.max(current.end.y, next.end.y),
//             };
//           }
//           // Also extend start if needed
//           const currentStart =
//             orientation === "horizontal" ? current.start.x : current.start.y;
//           const nextStartVal =
//             orientation === "horizontal" ? next.start.x : next.start.y;
//           if (nextStartVal < currentStart) {
//             if (orientation === "horizontal") {
//               current.start = { ...current.start, x: nextStartVal };
//             } else {
//               current.start = { ...current.start, y: nextStartVal };
//             }
//           }
//         } else {
//           merged.push(current);
//           current = { ...next };
//         }
//       }
//       merged.push(current);
//     }

//     return merged;
//   }

//   private rebuildTracesFromSegments(
//     segments: {
//       trace: SolvedTracePath;
//       start: Point;
//       end: Point;
//       index: number;
//       isHorizontal: boolean;
//     }[],
//   ): MergedTracePath[] {
//     // Group segments back by original trace
//     const traceMap = new Map<SolvedTracePath, Point[]>();

//     for (const seg of segments) {
//       if (!traceMap.has(seg.trace)) {
//         traceMap.set(seg.trace, []);
//       }
//       const points = traceMap.get(seg.trace)!;

//       if (points.length === 0) {
//         points.push(seg.start, seg.end);
//       } else {
//         const firstPoint = points[0];
//         const lastPoint = points[points.length - 1];

//         if (this.pointsEqual(lastPoint, seg.start)) {
//           points.push(seg.end);
//         } else if (this.pointsEqual(lastPoint, seg.end)) {
//           // Already have the end, skip
//         } else if (this.pointsEqual(firstPoint, seg.end)) {
//           points.unshift(seg.start);
//         } else if (this.pointsEqual(firstPoint, seg.start)) {
//           points.unshift(seg.end);
//         } else {
//           points.push(seg.start, seg.end);
//         }
//       }
//     }

//     // Deduplicate consecutive points
//     for (const [trace, points] of traceMap) {
//       const uniquePoints: Point[] = [];
//       for (const point of points) {
//         if (
//           uniquePoints.length === 0 ||
//           !this.pointsEqual(uniquePoints[uniquePoints.length - 1], point)
//         ) {
//           uniquePoints.push(point);
//         }
//       }
//       traceMap.set(trace, uniquePoints);
//     }

//     // Create merged trace paths
//     const result: MergedTracePath[] = [];
//     for (const [originalTrace, mergedPoints] of traceMap) {
//       if (mergedPoints.length >= 2) {
//         result.push({
//           ...originalTrace,
//           tracePath: mergedPoints,
//           originalTracePaths: [originalTrace],
//         });
//       } else {
//         result.push({
//           ...originalTrace,
//           originalTracePaths: [originalTrace],
//         });
//       }
//     }

//     return result;
//   }

//   private pointsEqual(p1: Point, p2: Point, tolerance: number = 1e-9): boolean {
//     return (
//       Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance
//     );
//   }

//   override visualize() {
//     return { lines: [], circles: [], rects: [], points: [], texts: [] };
//   }
// }

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
  alignThreshold: number;

  constructor(params: {
    solvedTracePaths: SolvedTracePath[];
    mergeThreshold?: number;
    alignThreshold?: number;
  }) {
    super();
    this.solvedTracePaths = params.solvedTracePaths;
    this.mergeThreshold = params.mergeThreshold ?? 0.5;
    this.alignThreshold = params.alignThreshold ?? 0.5;
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetSegmentMergingSolver
  >[0] {
    return {
      solvedTracePaths: this.solvedTracePaths,
      mergeThreshold: this.mergeThreshold,
      alignThreshold: this.alignThreshold,
    };
  }

  override _step() {
    if (!this.solvedTracePaths || this.solvedTracePaths.length === 0) {
      this.mergedTracePaths = [];
      this.solved = true;
      return;
    }

    // Group traces by netId
    const tracesByNet = new Map<string, SolvedTracePath[]>();

    for (const trace of this.solvedTracePaths) {
      let netId: string | undefined = (trace as any).netId;

      if (!netId && (trace as any).pins && (trace as any).pins.length > 0) {
        netId = (trace as any).pins[0]?.netId;
      }

      if (!netId) {
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

    // First, merge collinear segments (end-to-end)
    const mergedHorizontal = this.mergeCollinearSegments(
      horizontalSegments,
      "horizontal",
    );
    const mergedVertical = this.mergeCollinearSegments(
      verticalSegments,
      "vertical",
    );

    // Second, align parallel segments that are close to each other
    const alignedHorizontal = this.alignParallelSegments(
      mergedHorizontal,
      "horizontal",
    );
    const alignedVertical = this.alignParallelSegments(
      mergedVertical,
      "vertical",
    );

    // Combine all segments
    const alignedSegments = [...alignedHorizontal, ...alignedVertical];

    // If no alignment happened, return merged traces
    if (alignedSegments.length === allSegments.length) {
      return this.rebuildTracesFromSegments(alignedSegments);
    }

    return this.rebuildTracesFromSegments(alignedSegments);
  }

  /**
   * Align parallel segments that are within threshold distance
   * For horizontal segments: align to same Y coordinate
   * For vertical segments: align to same X coordinate
   */
  private alignParallelSegments(
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

    // Group segments by their position clusters
    const clusters: typeof segments[] = [];
    const used = new Set<number>();

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;

      const cluster: typeof segments = [segments[i]];
      used.add(i);

      const getPos = (seg: typeof segments[0]) =>
        orientation === "horizontal" ? seg.start.y : seg.start.x;

      const currentPos = getPos(segments[i]);

      for (let j = i + 1; j < segments.length; j++) {
        if (used.has(j)) continue;

        const otherPos = getPos(segments[j]);

        // Check if segments are within threshold distance
        if (Math.abs(currentPos - otherPos) <= this.alignThreshold) {
          cluster.push(segments[j]);
          used.add(j);
        }
      }

      if (cluster.length > 0) {
        clusters.push(cluster);
      }
    }

    // Align each cluster to the median position
    const alignedSegments = [...segments];

    for (const cluster of clusters) {
      if (cluster.length <= 1) continue;

      // Calculate median position for alignment
      const positions = cluster.map((seg) =>
        orientation === "horizontal" ? seg.start.y : seg.start.x,
      );
      const sortedPositions = [...positions].sort((a, b) => a - b);
      const medianPos =
        sortedPositions[Math.floor(sortedPositions.length / 2)];

      // Align all segments in cluster
      for (const seg of cluster) {
        const index = alignedSegments.findIndex(
          (s) =>
            s.trace === seg.trace &&
            s.index === seg.index &&
            s.start.x === seg.start.x &&
            s.start.y === seg.start.y,
        );

        if (index !== -1) {
          if (orientation === "horizontal") {
            // Align Y coordinate
            alignedSegments[index] = {
              ...alignedSegments[index],
              start: { ...alignedSegments[index].start, y: medianPos },
              end: { ...alignedSegments[index].end, y: medianPos },
            };
          } else {
            // Align X coordinate
            alignedSegments[index] = {
              ...alignedSegments[index],
              start: { ...alignedSegments[index].start, x: medianPos },
              end: { ...alignedSegments[index].end, x: medianPos },
            };
          }
        }
      }
    }

    return alignedSegments;
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

  private rebuildTracesFromSegments(
    segments: {
      trace: SolvedTracePath;
      start: Point;
      end: Point;
      index: number;
      isHorizontal: boolean;
    }[],
  ): MergedTracePath[] {
    // Group segments back by original trace
    const traceMap = new Map<SolvedTracePath, Point[]>();

    for (const seg of segments) {
      if (!traceMap.has(seg.trace)) {
        traceMap.set(seg.trace, []);
      }
      const points = traceMap.get(seg.trace)!;

      if (points.length === 0) {
        points.push(seg.start, seg.end);
      } else {
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

  private pointsEqual(p1: Point, p2: Point, tolerance: number = 1e-9): boolean {
    return (
      Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance
    );
  }

  override visualize() {
    return { lines: [], circles: [], rects: [], points: [], texts: [] };
  }
}