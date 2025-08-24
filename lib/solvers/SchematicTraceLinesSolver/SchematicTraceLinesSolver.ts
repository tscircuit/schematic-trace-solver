import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { GraphicsObject } from "graphics-debug"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import type { MspConnectionPair } from "../MspConnectionPairSolver/MspConnectionPairSolver"
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

  constructor(params: {
    mspConnectionPairs: MspConnectionPair[]
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

    this.queuedConnectionPairs = [...this.mspConnectionPairs]
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SchematicTraceLinesSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      mspConnectionPairs: this.mspConnectionPairs,
      dcConnMap: this.dcConnMap,
      globalConnMap: this.globalConnMap,
      guidelines: this.guidelines,
    }
  }

  override _step() {
    if (this.activeSubSolver?.solved) {
      this.activeSubSolver = null
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

    if (!connectionPair) {
      this.solved = true
      return
    }

    const { pins } = connectionPair

    this.activeSubSolver = new SchematicTraceSingleLineSolver({
      inputProblem: this.inputProblem,
      pins,
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

    return graphics
  }
}
