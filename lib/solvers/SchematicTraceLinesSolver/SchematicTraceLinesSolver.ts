import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getBounds, type GraphicsObject } from "graphics-debug"
import type { InputChip, InputProblem, PinId } from "lib/types/InputProblem"
import type {
  MspConnectionPair,
  MspConnectionPairId,
} from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { ConnectivityMap } from "connectivity-map"
import { SchematicTraceSingleLineSolver2 } from "./SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type { Guideline } from "../GuidelinesSolver/GuidelinesSolver"
import { visualizeGuidelines } from "../GuidelinesSolver/visualizeGuidelines"
import type { Point } from "@tscircuit/math-utils"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"

export interface SolvedTracePath extends MspConnectionPair {
  tracePath: Point[]
  mspConnectionPairIds: MspConnectionPairId[]
  pinIds: PinId[]
}
const snapToGrid = (path: Point[]): Point[] => {
  const TOLERANCE = 0.01
  return path.map((p) => ({
    x: Math.abs(p.x - Math.round(p.x)) < TOLERANCE ? Math.round(p.x) : p.x,
    y: Math.abs(p.y - Math.round(p.y)) < TOLERANCE ? Math.round(p.y) : p.y,
  }))
}
export class SchematicTraceLinesSolver extends BaseSolver {
  inputProblem: InputProblem
  mspConnectionPairs: MspConnectionPair[]

  dcConnMap: ConnectivityMap
  globalConnMap: ConnectivityMap

  queuedConnectionPairs: MspConnectionPair[]
  chipMap: Record<string, InputChip>

  currentConnectionPair: MspConnectionPair | null = null

  solvedTracePaths: Array<SolvedTracePath> = []
  failedConnectionPairs: Array<MspConnectionPair & { error?: string }> = []

  declare activeSubSolver: SchematicTraceSingleLineSolver2 | null

  constructor(params: {
    mspConnectionPairs: MspConnectionPair[]
    chipMap: Record<string, InputChip>
    dcConnMap: ConnectivityMap
    globalConnMap: ConnectivityMap
    inputProblem: InputProblem
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.mspConnectionPairs = params.mspConnectionPairs
    this.dcConnMap = params.dcConnMap
    this.globalConnMap = params.globalConnMap
    this.chipMap = params.chipMap

    this.queuedConnectionPairs = [...this.mspConnectionPairs]
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SchematicTraceLinesSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      chipMap: this.chipMap,
      mspConnectionPairs: this.mspConnectionPairs,
      dcConnMap: this.dcConnMap,
      globalConnMap: this.globalConnMap,
    }
  }

  override _step() {
    if (this.activeSubSolver?.solved) {
      this.solvedTracePaths.push({
        ...this.currentConnectionPair!,
        tracePath: this.activeSubSolver!.solvedTracePath!,
        mspConnectionPairIds: [this.currentConnectionPair!.mspPairId],
        pinIds: [
          this.currentConnectionPair!.pins[0].pinId,
          this.currentConnectionPair!.pins[1].pinId,
        ],
      })
      this.activeSubSolver = null
      this.currentConnectionPair = null
    }
    if (this.activeSubSolver?.failed) {
      // Record the failure for this connection and continue to the next pair
      if (this.currentConnectionPair) {
        this.failedConnectionPairs.push({
          ...this.currentConnectionPair,
          error: this.activeSubSolver.error || undefined,
        })
      }
      this.activeSubSolver = null
      this.currentConnectionPair = null
      // Do not fail the whole solver; proceed to schedule the next pair
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      return
    }

    const connectionPair = this.queuedConnectionPairs.shift()

    if (!connectionPair) {
      this.solved = true
      return
    }

    this.currentConnectionPair = connectionPair

    const { pins } = connectionPair

    this.activeSubSolver = new SchematicTraceSingleLineSolver2({
      inputProblem: this.inputProblem,
      pins,
      chipMap: this.chipMap,
    })
    if (this.activeSubSolver?.solved) {
      let finalPath = this.activeSubSolver!.solvedTracePath!

      finalPath = snapToGrid(finalPath)

      finalPath = simplifyPath(finalPath)

      this.solvedTracePaths.push({
        ...this.currentConnectionPair!,
        tracePath: finalPath,
        mspConnectionPairIds: [this.currentConnectionPair!.mspPairId],
        pinIds: [
          this.currentConnectionPair!.pins[0].pinId,
          this.currentConnectionPair!.pins[1].pinId,
        ],
      })

      this.activeSubSolver = null
      this.currentConnectionPair = null
    }
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const { mspPairId, tracePath } of this.solvedTracePaths) {
      graphics.lines!.push({
        points: tracePath,
        strokeColor: "green",
      })
    }

    // Indicate failed connection pairs with dashed red lines between their pins
    for (const pair of this.failedConnectionPairs) {
      graphics.lines!.push({
        points: [
          { x: pair.pins[0].x, y: pair.pins[0].y },
          { x: pair.pins[1].x, y: pair.pins[1].y },
        ],
        strokeColor: "red",
        strokeDash: "4 2",
      })
    }

    return graphics
  }
}
