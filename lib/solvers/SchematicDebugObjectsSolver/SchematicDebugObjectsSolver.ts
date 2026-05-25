import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * A post-processing solver that generates debug visualization objects
 * for the schematic trace solver output.
 *
 * It produces visual markers for:
 * - Trace endpoints (pin connections)
 * - Trace junction points where traces change direction
 * - Net label anchors with connectivity info
 * - Overlap/collision indicators
 *
 * This solver does not modify traces or labels — it only adds
 * debug graphics to help developers understand and verify the
 * solver output.
 */
export interface SchematicDebugObjectsSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

export class SchematicDebugObjectsSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  /** Debug objects produced by this solver */
  debugPoints: Array<{
    x: number
    y: number
    color: string
    label?: string
    radius?: number
  }> = []
  debugCircles: Array<{
    x: number
    y: number
    r: number
    fill?: string
    strokeColor?: string
    label?: string
  }> = []
  debugTexts: Array<{
    x: number
    y: number
    text: string
    color: string
    fontSize?: number
  }> = []

  constructor(params: SchematicDebugObjectsSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SchematicDebugObjectsSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  override _step() {
    this.debugPoints = []
    this.debugCircles = []
    this.debugTexts = []

    // Mark trace endpoints (pin connections)
    for (const trace of this.traces) {
      const path = trace.tracePath
      if (path.length === 0) continue

      const color = getColorFromString(
        trace.globalConnNetId ?? trace.mspPairId,
        0.9,
      )

      // Start point
      this.debugPoints.push({
        x: path[0]!.x,
        y: path[0]!.y,
        color,
        label: `start:${trace.globalConnNetId ?? trace.mspPairId}`,
        radius: 0.15,
      })

      // End point
      this.debugPoints.push({
        x: path[path.length - 1]!.x,
        y: path[path.length - 1]!.y,
        color,
        label: `end:${trace.globalConnNetId ?? trace.mspPairId}`,
        radius: 0.15,
      })

      // Mark junction points (direction changes)
      for (let i = 1; i < path.length - 1; i++) {
        const prev = path[i - 1]!
        const curr = path[i]!
        const next = path[i + 1]!

        const dx1 = curr.x - prev.x
        const dy1 = curr.y - prev.y
        const dx2 = next.x - curr.x
        const dy2 = next.y - curr.y

        // Direction change = junction
        const crossProduct = dx1 * dy2 - dy1 * dx2
        if (Math.abs(crossProduct) > 0.001) {
          this.debugCircles.push({
            x: curr.x,
            y: curr.y,
            r: 0.08,
            fill: color,
            strokeColor: "black",
            label: `junction`,
          })
        }
      }
    }

    // Mark net label anchors
    for (const label of this.netLabelPlacements) {
      const color = getColorFromString(label.globalConnNetId, 0.9)

      this.debugPoints.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: "orange",
        label: `anchor:${label.globalConnNetId}`,
        radius: 0.1,
      })

      this.debugTexts.push({
        x: label.center.x,
        y: label.center.y + label.height / 2 + 0.15,
        text: `net:${label.globalConnNetId}`,
        color,
        fontSize: 8,
      })
    }

    this.solved = true
  }

  getOutput() {
    return {
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
      debugPoints: this.debugPoints,
      debugCircles: this.debugCircles,
      debugTexts: this.debugTexts,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)
    if (!graphics.lines) graphics.lines = []
    if (!graphics.rects) graphics.rects = []
    if (!graphics.points) graphics.points = []
    if (!graphics.circles) graphics.circles = []
    if (!graphics.texts) graphics.texts = []

    // Draw traces
    for (const trace of this.traces) {
      const color = getColorFromString(
        trace.globalConnNetId ?? trace.mspPairId,
        0.7,
      )
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: color,
      } as any)
    }

    // Draw net labels
    for (const label of this.netLabelPlacements) {
      const color = getColorFromString(label.globalConnNetId, 0.35)
      graphics.rects.push({
        center: label.center,
        width: label.width,
        height: label.height,
        fill: color,
        strokeColor: getColorFromString(label.globalConnNetId, 0.9),
        label: `${label.globalConnNetId}`,
      } as any)
    }

    // Draw debug points
    for (const dp of this.debugPoints) {
      graphics.points.push({
        x: dp.x,
        y: dp.y,
        color: dp.color,
        label: dp.label,
      } as any)
    }

    // Draw debug circles
    for (const dc of this.debugCircles) {
      graphics.circles.push({
        x: dc.x,
        y: dc.y,
        r: dc.r,
        fill: dc.fill,
        strokeColor: dc.strokeColor,
        label: dc.label,
      } as any)
    }

    // Draw debug texts
    for (const dt of this.debugTexts) {
      graphics.texts.push({
        x: dt.x,
        y: dt.y,
        text: dt.text,
        color: dt.color,
      } as any)
    }

    return graphics
  }
}
