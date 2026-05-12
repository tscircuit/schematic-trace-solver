import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

interface SameNetTraceMergeSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

type SegmentRef = {
  traceIndex: number
  p1Index: number
  p2Index: number
  netId: string
  fixedCoord: number
  minBound: number
  maxBound: number
}

export class SameNetTraceMergeSolver extends BaseSolver {
  private input: SameNetTraceMergeSolverInput
  public outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.input = input
    this.outputTraces = JSON.parse(JSON.stringify(input.traces))
  }

  override _step() {

    this.mergeCloseSegments();

    this.fuseCollinearTraces();

    for (const trace of this.outputTraces) {
      trace.tracePath = simplifyPath(trace.tracePath);
    }
    
    this.solved = true;
  }

  private fuseCollinearTraces() {
    let madeChange = true;
    while (madeChange) {
      madeChange = false;
      for (let i = 0; i < this.outputTraces.length; i++) {
        for (let j = i + 1; j < this.outputTraces.length; j++) {
          const t1 = this.outputTraces[i];
          const t2 = this.outputTraces[j];

          if (t1.globalConnNetId !== t2.globalConnNetId) continue;

          const p1Start = t1.tracePath[0];
          const p1End = t1.tracePath[t1.tracePath.length - 1];
          const p2Start = t2.tracePath[0];
          const p2End = t2.tracePath[t2.tracePath.length - 1];

          if (this.isSamePoint(p1End, p2Start)) {
            t1.tracePath.push(...t2.tracePath.slice(1));
            this.outputTraces.splice(j, 1);
            madeChange = true;
            break;
          } else if (this.isSamePoint(p1Start, p2End)) {
            t2.tracePath.push(...t1.tracePath.slice(1));
            this.outputTraces.splice(i, 1);
            madeChange = true;
            break;
          }
        }
        if (madeChange) break;
      }
    }
  }

  private isSamePoint(p1: any, p2: any) {
    return Math.abs(p1.x - p2.x) < 0.01 && Math.abs(p1.y - p2.y) < 0.01;
  }

  private mergeCloseSegments() {
    const TOLERANCE = 0.1; 
    const horizontalSegments: SegmentRef[] = [];
    const verticalSegments: SegmentRef[] = [];

    for (let tIdx = 0; tIdx < this.outputTraces.length; tIdx++) {
      const trace = this.outputTraces[tIdx];
      const path = trace.tracePath;
      
      const netId = trace.globalConnNetId || (trace as any).netId || "unknown";

      for (let pIdx = 0; pIdx < path.length - 1; pIdx++) {
        const p1 = path[pIdx];
        const p2 = path[pIdx + 1];

        if (Math.abs(p1.y - p2.y) < 0.01) { 
          horizontalSegments.push({
            traceIndex: tIdx, p1Index: pIdx, p2Index: pIdx + 1, netId,
            fixedCoord: p1.y, minBound: Math.min(p1.x, p2.x), maxBound: Math.max(p1.x, p2.x)
          });
        } else if (Math.abs(p1.x - p2.x) < 0.01) { 
          verticalSegments.push({
            traceIndex: tIdx, p1Index: pIdx, p2Index: pIdx + 1, netId,
            fixedCoord: p1.x, minBound: Math.min(p1.y, p2.y), maxBound: Math.max(p1.y, p2.y)
          });
        }
      }
    }

    this.processGroups(horizontalSegments, 'y', TOLERANCE);
    this.processGroups(verticalSegments, 'x', TOLERANCE);
  }

  private processGroups(segments: SegmentRef[], axis: 'x' | 'y', tolerance: number) {
    const byNet = this.groupByNetId(segments);
    
    for (const [netId, netSegments] of Object.entries(byNet)) {
      netSegments.sort((a, b) => a.fixedCoord - b.fixedCoord);

      let i = 0;
      while (i < netSegments.length) {
        let j = i + 1;
        const cluster = [netSegments[i]];
        
        while (j < netSegments.length) {
          const current = netSegments[j];
          const prev = cluster[cluster.length - 1];
          
          const dist = Math.abs(current.fixedCoord - prev.fixedCoord);
          const overlaps = (current.minBound <= prev.maxBound + 0.1 && current.maxBound >= prev.minBound - 0.1);
          
          if (dist <= tolerance && overlaps) {
            cluster.push(current);
            j++;
          } else {
            break;
          }
        }
        
        if (cluster.length > 1) {
          this.snapCluster(cluster, axis);
        }
        i = j;
      }
    }
  }

  private groupByNetId(segments: SegmentRef[]): Record<string, SegmentRef[]> {
    return segments.reduce((acc, seg) => {
      if (!acc[seg.netId]) acc[seg.netId] = [];
      acc[seg.netId].push(seg);
      return acc;
    }, {} as Record<string, SegmentRef[]>);
  }

  private snapCluster(cluster: SegmentRef[], axis: 'x' | 'y') {
    const sum = cluster.reduce((acc, seg) => acc + seg.fixedCoord, 0);
    const avg = sum / cluster.length;

    for (const seg of cluster) {
      const path = this.outputTraces[seg.traceIndex].tracePath;
      path[seg.p1Index][axis] = avg;
      path[seg.p2Index][axis] = avg;
    }
  }

  getOutput() { return { traces: this.outputTraces }; }

  override visualize(): GraphicsObject {
    return {};
  }
}