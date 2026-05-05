import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

/**
 * Merges same-net trace segments that are collinear and close together.
 * Groups traces by globalConnNetId and snaps near-parallel segments onto
 * the same axis coordinate to eliminate visual clutter from adjacent traces.
 *
 * Addresses: https://github.com/tscircuit/schematic-trace-solver/issues/34
 */

const COLLINEAR_TOLERANCE = 0.05
const GAP_TOLERANCE = 0.15

interface ExtractedSegment {
  traceIndex: number
  segIndex: number
  direction: "horizontal" | "vertical"
  coord: number
  min: number
  max: number
}

function extractSegments(
  traces: SolvedTracePath[],
  indices: number[],
): ExtractedSegment[] {
  const segments: ExtractedSegment[] = []
  for (const ti of indices) {
    const path = traces[ti].tracePath
    for (let si = 0; si < path.length - 1; si++) {
      const p1 = path[si]
      const p2 = path[si + 1]
      const dx = Math.abs(p2.x - p1.x)
      const dy = Math.abs(p2.y - p1.y)
      if (dy < 1e-6 && dx > 1e-6) {
        segments.push({
          traceIndex: ti,
          segIndex: si,
          direction: "horizontal",
          coord: (p1.y + p2.y) / 2,
          min: Math.min(p1.x, p2.x),
          max: Math.max(p1.x, p2.x),
        })
      } else if (dx < 1e-6 && dy > 1e-6) {
        segments.push({
          traceIndex: ti,
          segIndex: si,
          direction: "vertical",
          coord: (p1.x + p2.x) / 2,
          min: Math.min(p1.y, p2.y),
          max: Math.max(p1.y, p2.y),
        })
      }
    }
  }
  return segments
}

function trySnapSegment(
  traces: SolvedTracePath[],
  sB: ExtractedSegment,
  targetCoord: number,
): boolean {
  const path = traces[sB.traceIndex].tracePath
  const si = sB.segIndex
  const isFirstPin = si === 0
  const isLastPin = si + 1 === path.length - 1

  if (isFirstPin || isLastPin) return false

  if (sB.direction === "horizontal") {
    path[si] = { ...path[si], y: targetCoord }
    path[si + 1] = { ...path[si + 1], y: targetCoord }
  } else {
    path[si] = { ...path[si], x: targetCoord }
    path[si + 1] = { ...path[si + 1], x: targetCoord }
  }

  traces[sB.traceIndex] = {
    ...traces[sB.traceIndex],
    tracePath: simplifyPath(path),
  }
  return true
}

function combineTracesForNet(
  traces: SolvedTracePath[],
  indices: number[],
): void {
  let changed = true
  while (changed) {
    changed = false
    const segments = extractSegments(traces, indices)

    for (let i = 0; i < segments.length; i++) {
      if (changed) break
      for (let j = i + 1; j < segments.length; j++) {
        const sA = segments[i]
        const sB = segments[j]

        if (sA.traceIndex === sB.traceIndex) continue
        if (sA.direction !== sB.direction) continue
        const dist = Math.abs(sA.coord - sB.coord)
        if (dist < 1e-9 || dist > COLLINEAR_TOLERANCE) continue

        const overlapStart = Math.max(sA.min, sB.min)
        const overlapEnd = Math.min(sA.max, sB.max)
        const gap = overlapStart - overlapEnd

        if (gap > GAP_TOLERANCE) continue

        if (trySnapSegment(traces, sB, sA.coord)) {
          changed = true
          break
        }
      }
    }
  }
}

export interface SameNetTraceCombiningSolverParams {
  traces: SolvedTracePath[]
}

export class SameNetTraceCombiningSolver extends BaseSolver {
  private inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  constructor({ traces }: SameNetTraceCombiningSolverParams) {
    super()
    this.inputTraces = traces
    this.outputTraces = this._combineSameNetTraces()
    this.solved = true
  }

  private _combineSameNetTraces(): SolvedTracePath[] {
    const traces: SolvedTracePath[] = this.inputTraces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))

    const netGroups = new Map<string, number[]>()
    for (let i = 0; i < traces.length; i++) {
      const netId = traces[i].globalConnNetId
      if (!netGroups.has(netId)) netGroups.set(netId, [])
      netGroups.get(netId)!.push(i)
    }

    for (const [, indices] of netGroups) {
      if (indices.length < 2) continue
      combineTracesForNet(traces, indices)
    }

    return traces
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }

  override _step(): void {
    this.solved = true
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.map((t) => ({
        points: t.tracePath,
        strokeColor: "blue",
      })),
    }
  }
}
