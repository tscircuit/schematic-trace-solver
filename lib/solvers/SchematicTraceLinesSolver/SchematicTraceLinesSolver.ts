import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { type GraphicsObject } from "graphics-debug"
import type { InputChip, InputProblem, PinId } from "lib/types/InputProblem"
import type {
  MspConnectionPair,
  MspConnectionPairId,
} from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { ConnectivityMap } from "connectivity-map"
import { SchematicTraceSingleLineSolver2 } from "./SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type { Point } from "@tscircuit/math-utils"

export interface SolvedTracePath extends MspConnectionPair {
  tracePath: Point[]
  mspConnectionPairIds: MspConnectionPairId[]
  pinIds: PinId[]
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
      // --- START OF FIX: Snap new path to existing same-net traces ---
      const rawPath = this.activeSubSolver!.solvedTracePath!
      const snappedPath = this.snapPathToExistingTraces(rawPath)
      // --- END OF FIX ---

      this.solvedTracePaths.push({
        ...this.currentConnectionPair!,
        tracePath: snappedPath,
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
      if (this.currentConnectionPair) {
        this.failedConnectionPairs.push({
          ...this.currentConnectionPair,
          error: this.activeSubSolver.error || undefined,
        })
      }
      this.activeSubSolver = null
      this.currentConnectionPair = null
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

  /**
   * Snaps a new path's points to the X or Y coordinates of existing traces 
   * in the same net if they are within a 0.1mm tolerance.
   */
  private snapPathToExistingTraces(path: Point[]): Point[] {
    const TOLERANCE = 0.1

    const sameNetPaths = this.solvedTracePaths.filter((solved) => {
      if (!this.currentConnectionPair || !solved.pinIds?.[0]) return false
      return this.globalConnMap.areConnected(
        this.currentConnectionPair.pins[0].pinId,
        solved.pinIds[0],
      )
    })

    if (sameNetPaths.length === 0) return path

    const existingPoints: Point[] = sameNetPaths.flatMap((solved) => solved.tracePath)

    return path.map((point) => {
      let snappedX = point.x
      let snappedY = point.y

      for (const existing of existingPoints) {
        if (Math.abs(point.x - existing.x) <= TOLERANCE) {
          snappedX = existing.x
        }
        if (Math.abs(point.y - existing.y) <= TOLERANCE) {
          snappedY = existing.y
        }
      }

      return { x: snappedX, y: snappedY }
    })
  }
}
