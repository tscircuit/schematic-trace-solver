import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject, Line } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

/** Maximum distance between parallel same-net segments for them to be merged */
const MERGE_THRESHOLD = 0.2

/** Minimum overlap length required before merging two parallel segments */
const MIN_OVERLAP = 0.05

/**
 * SameNetTraceMergingSolver finds pairs of traces that belong to the same
 * electrical net and have parallel segments running close together, then
 * snaps those segments onto a shared axis to eliminate the visual clutter
 * of near-duplicate wires.
 *
 * Only interior segment endpoints are moved — the first and last points of
 * each trace (which sit at pin locations) are never displaced.
 *
 * The solver runs iteratively: each _step() finds and applies one merge,
 * then re-scans.  It terminates when no more candidate pairs exist.
 */
export class SameNetTraceMergingSolver extends BaseSolver {
  inputProblem: InputProblem
  outputTraces: SolvedTracePath[]

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    // Deep-copy trace paths so we don't mutate upstream data
    this.outputTraces = params.traces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergingSolver
  >[0] {
    return { inputProblem: this.inputProblem, traces: this.outputTraces }
  }

  override _step() {
    // Group traces by globalConnNetId
    const groups = new Map<string, SolvedTracePath[]>()
    for (const trace of this.outputTraces) {
      const key = trace.globalConnNetId
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(trace)
    }

    for (const traces of groups.values()) {
      if (traces.length < 2) continue
      for (let i = 0; i < traces.length; i++) {
        for (let j = i + 1; j < traces.length; j++) {
          if (this._tryMerge(traces[i], traces[j])) return
        }
      }
    }

    // No merge was possible — we're done
    this.solved = true
  }

  /**
   * Attempt to find one pair of parallel same-net segments across t1 and t2
   * that are close enough to snap together.  Returns true if a merge occurred.
   */
  private _tryMerge(t1: SolvedTracePath, t2: SolvedTracePath): boolean {
    const p1 = t1.tracePath
    const p2 = t2.tracePath

    for (let i = 0; i < p1.length - 1; i++) {
      for (let j = 0; j < p2.length - 1; j++) {
        const a1 = p1[i]
        const b1 = p1[i + 1]
        const a2 = p2[j]
        const b2 = p2[j + 1]

        const seg1IsHoriz = Math.abs(a1.y - b1.y) < 1e-6
        const seg2IsHoriz = Math.abs(a2.y - b2.y) < 1e-6

        if (seg1IsHoriz !== seg2IsHoriz) continue

        if (seg1IsHoriz) {
          // Both horizontal — check vertical proximity & x overlap
          const dy = Math.abs(a1.y - a2.y)
          if (dy < 1e-6 || dy > MERGE_THRESHOLD) continue

          const xMin1 = Math.min(a1.x, b1.x)
          const xMax1 = Math.max(a1.x, b1.x)
          const xMin2 = Math.min(a2.x, b2.x)
          const xMax2 = Math.max(a2.x, b2.x)
          const overlap = Math.min(xMax1, xMax2) - Math.max(xMin1, xMin2)
          if (overlap < MIN_OVERLAP) continue

          // Snap the movable segment to the fixed one's axis.
          // Prefer moving t2 onto t1; never move a pin endpoint.
          const t2CanMove = j > 0 && j + 1 < p2.length - 1
          const t1CanMove = i > 0 && i + 1 < p1.length - 1

          if (t2CanMove) {
            p2[j] = { ...p2[j], y: a1.y }
            p2[j + 1] = { ...p2[j + 1], y: a1.y }
            this._removeDuplicatePoints(t2)
            return true
          }
          if (t1CanMove) {
            p1[i] = { ...p1[i], y: a2.y }
            p1[i + 1] = { ...p1[i + 1], y: a2.y }
            this._removeDuplicatePoints(t1)
            return true
          }
        } else {
          // Both vertical — check horizontal proximity & y overlap
          const dx = Math.abs(a1.x - a2.x)
          if (dx < 1e-6 || dx > MERGE_THRESHOLD) continue

          const yMin1 = Math.min(a1.y, b1.y)
          const yMax1 = Math.max(a1.y, b1.y)
          const yMin2 = Math.min(a2.y, b2.y)
          const yMax2 = Math.max(a2.y, b2.y)
          const overlap = Math.min(yMax1, yMax2) - Math.max(yMin1, yMin2)
          if (overlap < MIN_OVERLAP) continue

          const t2CanMove = j > 0 && j + 1 < p2.length - 1
          const t1CanMove = i > 0 && i + 1 < p1.length - 1

          if (t2CanMove) {
            p2[j] = { ...p2[j], x: a1.x }
            p2[j + 1] = { ...p2[j + 1], x: a1.x }
            this._removeDuplicatePoints(t2)
            return true
          }
          if (t1CanMove) {
            p1[i] = { ...p1[i], x: a2.x }
            p1[i + 1] = { ...p1[i + 1], x: a2.x }
            this._removeDuplicatePoints(t1)
            return true
          }
        }
      }
    }

    return false
  }

  /**
   * Remove consecutive duplicate / zero-length points that may arise after
   * snapping a segment to an adjacent axis.
   */
  private _removeDuplicatePoints(trace: SolvedTracePath) {
    const path = trace.tracePath
    const cleaned = [path[0]]
    for (let k = 1; k < path.length; k++) {
      const prev = cleaned[cleaned.length - 1]
      if (
        Math.abs(path[k].x - prev.x) > 1e-9 ||
        Math.abs(path[k].y - prev.y) > 1e-9
      ) {
        cleaned.push(path[k])
      }
    }
    trace.tracePath = cleaned
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const base = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })
    const lines: Line[] = this.outputTraces.map((t) => ({
      points: t.tracePath.map((p) => ({ x: p.x, y: p.y })),
      strokeColor: "blue",
    }))
    return { ...base, lines: [...(base.lines ?? []), ...lines] }
  }
}
