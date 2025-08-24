import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getBounds, type GraphicsObject } from "graphics-debug"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import type {
  MspConnectionPair,
  MspConnectionPairId,
} from "../MspConnectionPairSolver/MspConnectionPairSolver"
import type { ConnectivityMap } from "connectivity-map"
import { SchematicTraceSingleLineSolver } from "./SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"
import type { Guideline } from "../GuidelinesSolver/GuidelinesSolver"

export class SchematicTraceLinesSolver extends BaseSolver {
  inputProblem: InputProblem
  guidelines: Guideline[]
  mspConnectionPairs: MspConnectionPair[]

  dcConnMap: ConnectivityMap
  globalConnMap: ConnectivityMap

  queuedConnectionPairs: MspConnectionPair[]
  chipMap: Record<string, InputChip>

  currentConnectionPair: MspConnectionPair | null = null

  solvedTracePaths: Record<MspConnectionPairId, { x: number; y: number }[]> = {}

  declare activeSubSolver: SchematicTraceSingleLineSolver | null

  constructor(params: {
    mspConnectionPairs: MspConnectionPair[]
    chipMap: Record<string, InputChip>
    dcConnMap: ConnectivityMap
    globalConnMap: ConnectivityMap
    inputProblem: InputProblem
    guidelines: Guideline[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.mspConnectionPairs = params.mspConnectionPairs
    this.dcConnMap = params.dcConnMap
    this.globalConnMap = params.globalConnMap
    this.guidelines = params.guidelines
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
      guidelines: this.guidelines,
    }
  }

  override _step() {
    if (this.activeSubSolver?.solved) {
      this.solvedTracePaths[this.currentConnectionPair!.mspPairId] =
        this.activeSubSolver!.solvedTracePath!
      this.activeSubSolver = null
      this.currentConnectionPair = null
    }
    if (this.activeSubSolver?.failed) {
      this.failed = true
      this.error = this.activeSubSolver.error
      return
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      return
    }

    const connectionPair = this.queuedConnectionPairs.shift()
    this.currentConnectionPair = connectionPair!

    if (!connectionPair) {
      this.solved = true
      return
    }

    const { pins } = connectionPair

    this.activeSubSolver = new SchematicTraceSingleLineSolver({
      inputProblem: this.inputProblem,
      pins,
      chipMap: this.chipMap,
      guidelines: this.guidelines,
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

    const globalBounds = getBounds(graphics)
    const boundsWidth = globalBounds.maxX - globalBounds.minX
    const boundsHeight = globalBounds.maxY - globalBounds.minY
    globalBounds.minX -= boundsWidth * 0.3
    globalBounds.maxX += boundsWidth * 0.3
    globalBounds.minY -= boundsHeight * 0.3
    globalBounds.maxY += boundsHeight * 0.3

    for (const guideline of this.guidelines) {
      if (guideline.orientation === "horizontal") {
        graphics.lines!.push({
          points: [
            { x: globalBounds.minX, y: guideline.y },
            { x: globalBounds.maxX, y: guideline.y },
          ],
          strokeColor: "rgba(0, 0, 0, 0.5)",
          strokeDash: "2 2",
        })
      }

      if (guideline.orientation === "vertical") {
        graphics.lines!.push({
          points: [
            { x: guideline.x, y: globalBounds.minY },
            { x: guideline.x, y: globalBounds.maxY },
          ],
          strokeColor: "rgba(0, 0, 0, 0.5)",
          strokeDash: "2 2",
        })
      }
    }

    for (const [mspPairId, tracePath] of Object.entries(
      this.solvedTracePaths,
    )) {
      graphics.lines!.push({
        points: tracePath,
        strokeColor: "green",
      })
    }

    return graphics
  }
}
