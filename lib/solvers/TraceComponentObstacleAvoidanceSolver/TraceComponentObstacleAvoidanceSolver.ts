import type { GraphicsObject } from "graphics-debug"
import type { Bounds, Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"

const EPS = 1e-9

export interface TraceComponentObstacleAvoidanceSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  /** Gap kept between a rerouted trace and the component edge it routes around. */
  padding?: number
}

/**
 * Reroutes traces that run through a schematic component (chip) body so they
 * travel *around* the component instead of through it.
 *
 * Earlier pipeline stages — notably the UntangleTraceSubsolver inside the
 * TraceCleanupSolver — only treat *other traces* as obstacles. While dodging a
 * crossing trace they can shift a segment straight across a component box. This
 * solver runs right after trace cleanup and treats components as obstacles: for
 * every trace segment that crosses a component's interior it shifts that segment
 * just past the nearest component edge and stretches the two neighbouring
 * segments to keep the path orthogonal.
 *
 * It is deliberately component-only (it ignores other traces), so a reroute can
 * still cross another trace — a benign, legal schematic condition — but it will
 * never leave a wire running through a component body. A segment that merely
 * terminates at a pin on a component's edge is *not* considered a crossing,
 * because only strict interior crossings are rerouted.
 */
export class TraceComponentObstacleAvoidanceSolver extends BaseSolver {
  private input: TraceComponentObstacleAvoidanceSolverInput
  private chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  private padding: number
  private tracesMap: Map<string, SolvedTracePath>
  private traceIdQueue: string[]
  private activeTraceId: string | null = null

  constructor(solverInput: TraceComponentObstacleAvoidanceSolverInput) {
    super()
    this.input = solverInput
    this.padding = solverInput.padding ?? 0.1

    this.chipObstacleSpatialIndex =
      solverInput.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(solverInput.inputProblem.chips)
    if (!solverInput.inputProblem._chipObstacleSpatialIndex) {
      solverInput.inputProblem._chipObstacleSpatialIndex =
        this.chipObstacleSpatialIndex
    }

    this.tracesMap = new Map(
      solverInput.traces.map((t) => [t.mspPairId as string, t]),
    )
    this.traceIdQueue = solverInput.traces.map((t) => t.mspPairId as string)
  }

  override _step() {
    const traceId = this.traceIdQueue.shift()
    if (traceId === undefined) {
      this.solved = true
      return
    }

    this.activeTraceId = traceId
    const trace = this.tracesMap.get(traceId)!
    const reroutedPath = this._rerouteTraceAroundChips(trace.tracePath)
    if (reroutedPath) {
      this.tracesMap.set(traceId, { ...trace, tracePath: reroutedPath })
    }
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: Array.from(this.tracesMap.values()) }
  }

  /**
   * Returns a rerouted copy of the path with every interior-crossing segment
   * shifted clear of the component it crosses, or null if nothing changed.
   *
   * Only interior segments (both endpoints are bends, not the trace's terminal
   * pins) can be shifted, since moving a terminal point would detach the trace
   * from its pin.
   */
  private _rerouteTraceAroundChips(path: Point[]): Point[] | null {
    // Need at least one segment that has a neighbour on both sides.
    if (path.length < 4) return null

    const result = path.map((p) => ({ x: p.x, y: p.y }))
    let changed = false

    for (let i = 1; i <= result.length - 3; i++) {
      const shifted = this._shiftSegmentClearOfChips(result, i)
      if (shifted) {
        result[i] = shifted.a
        result[i + 1] = shifted.b
        changed = true
      }
    }

    return changed ? result : null
  }

  /**
   * If segment `i` (between path[i] and path[i+1]) crosses a component interior,
   * returns the new endpoints of that segment shifted just past the nearest
   * component edge, or null if it does not cross or cannot be shifted cleanly.
   */
  private _shiftSegmentClearOfChips(
    path: Point[],
    i: number,
  ): { a: Point; b: Point } | null {
    const prev = path[i - 1]!
    const a = path[i]!
    const b = path[i + 1]!
    const next = path[i + 2]!

    const crossedChips = this._getInteriorCrossedChips(a, b)
    if (crossedChips.length === 0) return null

    const isVertical = Math.abs(a.x - b.x) < EPS
    const isHorizontal = Math.abs(a.y - b.y) < EPS

    if (isVertical) {
      // Neighbouring segments must be horizontal for an in-place shift to keep
      // the path orthogonal.
      if (Math.abs(prev.y - a.y) > EPS || Math.abs(next.y - b.y) > EPS) {
        return null
      }
      const minEdge = Math.min(...crossedChips.map((c) => c.bounds.minX))
      const maxEdge = Math.max(...crossedChips.map((c) => c.bounds.maxX))
      const options = [minEdge - this.padding, maxEdge + this.padding].sort(
        (x1, x2) => Math.abs(x1 - a.x) - Math.abs(x2 - a.x),
      )
      for (const x of options) {
        const a2 = { x, y: a.y }
        const b2 = { x, y: b.y }
        if (
          this._isSegmentClear(prev, a2) &&
          this._isSegmentClear(a2, b2) &&
          this._isSegmentClear(b2, next)
        ) {
          return { a: a2, b: b2 }
        }
      }
      return null
    }

    if (isHorizontal) {
      if (Math.abs(prev.x - a.x) > EPS || Math.abs(next.x - b.x) > EPS) {
        return null
      }
      const minEdge = Math.min(...crossedChips.map((c) => c.bounds.minY))
      const maxEdge = Math.max(...crossedChips.map((c) => c.bounds.maxY))
      const options = [minEdge - this.padding, maxEdge + this.padding].sort(
        (y1, y2) => Math.abs(y1 - a.y) - Math.abs(y2 - a.y),
      )
      for (const y of options) {
        const a2 = { x: a.x, y }
        const b2 = { x: b.x, y }
        if (
          this._isSegmentClear(prev, a2) &&
          this._isSegmentClear(a2, b2) &&
          this._isSegmentClear(b2, next)
        ) {
          return { a: a2, b: b2 }
        }
      }
      return null
    }

    return null
  }

  private _isSegmentClear(a: Point, b: Point): boolean {
    return this._getInteriorCrossedChips(a, b).length === 0
  }

  private _getInteriorCrossedChips(
    a: Point,
    b: Point,
  ): Array<{ bounds: Bounds }> {
    const nearbyChips = this.chipObstacleSpatialIndex.getChipsInBounds({
      minX: Math.min(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxX: Math.max(a.x, b.x),
      maxY: Math.max(a.y, b.y),
    })

    return nearbyChips.filter((chip) =>
      this._segmentCrossesChipInterior(a, b, chip.bounds),
    )
  }

  /**
   * True only when the orthogonal segment passes through the open interior of
   * the component box. A segment that runs along an edge or terminates at a pin
   * on the boundary touches the box but does not cross its interior, so it is
   * left alone.
   */
  private _segmentCrossesChipInterior(
    a: Point,
    b: Point,
    bounds: Bounds,
  ): boolean {
    if (Math.abs(a.x - b.x) < EPS) {
      const x = a.x
      if (x <= bounds.minX + EPS || x >= bounds.maxX - EPS) return false
      const lo = Math.min(a.y, b.y)
      const hi = Math.max(a.y, b.y)
      return Math.min(hi, bounds.maxY) - Math.max(lo, bounds.minY) > EPS
    }

    if (Math.abs(a.y - b.y) < EPS) {
      const y = a.y
      if (y <= bounds.minY + EPS || y >= bounds.maxY - EPS) return false
      const lo = Math.min(a.x, b.x)
      const hi = Math.max(a.x, b.x)
      return Math.min(hi, bounds.maxX) - Math.max(lo, bounds.minX) > EPS
    }

    return false
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    graphics.lines ??= []
    for (const trace of this.tracesMap.values()) {
      graphics.lines.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: trace.mspPairId === this.activeTraceId ? "red" : "blue",
      })
    }

    return graphics
  }
}
