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
import { getPinDirectionCandidates } from "./SchematicTraceSingleLineSolver/getPinDirection"

const shouldPreferExteriorDetours = ({
  connectionPair,
  allConnectionPairs,
  inputProblem,
}: {
  connectionPair: MspConnectionPair
  allConnectionPairs: MspConnectionPair[]
  inputProblem: InputProblem
}) => {
  const [firstPin, secondPin] = connectionPair.pins
  const belongsToNetConnection = inputProblem.netConnections.some(
    (netConnection) =>
      netConnection.pinIds.includes(firstPin.pinId) &&
      netConnection.pinIds.includes(secondPin.pinId),
  )
  if (belongsToNetConnection) return true

  return allConnectionPairs.some((otherPair) => {
    if (otherPair === connectionPair) return false

    const [otherFirstPin, otherSecondPin] = otherPair.pins
    const sameOrder =
      firstPin.chipId === otherFirstPin.chipId &&
      secondPin.chipId === otherSecondPin.chipId
    if (sameOrder) return true

    return (
      firstPin.chipId === otherSecondPin.chipId &&
      secondPin.chipId === otherFirstPin.chipId
    )
  })
}

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
  retryingWithoutNetLabelClearance = false

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
        pins: this.activeSubSolver.pins,
        tracePath: this.activeSubSolver!.solvedTracePath!,
        mspConnectionPairIds: [this.currentConnectionPair!.mspPairId],
        pinIds: [
          this.currentConnectionPair!.pins[0].pinId,
          this.currentConnectionPair!.pins[1].pinId,
        ],
      })
      this.activeSubSolver = null
      this.currentConnectionPair = null
      this.retryingWithoutNetLabelClearance = false
    }
    if (this.activeSubSolver?.failed) {
      if (
        this.currentConnectionPair &&
        !this.retryingWithoutNetLabelClearance &&
        this.activeSubSolver.hasAmbiguousPinDirections
      ) {
        const connectionPair = this.currentConnectionPair
        this.retryingWithoutNetLabelClearance = true
        this.activeSubSolver = new SchematicTraceSingleLineSolver2({
          inputProblem: this.inputProblem,
          pins: connectionPair.pins.map((pin) => ({
            ...pin,
          })) as MspConnectionPair["pins"],
          connectionPair,
          chipMap: this.chipMap,
          preferExteriorDetours: shouldPreferExteriorDetours({
            connectionPair,
            allConnectionPairs: this.mspConnectionPairs,
            inputProblem: this.inputProblem,
          }),
          reserveNetLabelClearance: false,
        })
        return
      }

      // Record the failure for this connection and continue to the next pair
      if (this.currentConnectionPair) {
        this.failedConnectionPairs.push({
          ...this.currentConnectionPair,
          error: this.activeSubSolver.error || undefined,
        })
      }
      this.activeSubSolver = null
      this.currentConnectionPair = null
      this.retryingWithoutNetLabelClearance = false
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
    this.retryingWithoutNetLabelClearance = false

    // Corner pins can legitimately face either adjacent edge. Keep their
    // inferred direction local to this route so solving one branch cannot
    // constrain a later branch that shares the same corner pin. Pins with one
    // geometric direction retain the established shared representation.
    const hasAmbiguousCornerPin = connectionPair.pins.some((pin) => {
      if (pin._facingDirection) return false
      const chip = this.chipMap[pin.chipId]
      return chip && getPinDirectionCandidates(pin, chip).length > 1
    })
    const pins = hasAmbiguousCornerPin
      ? (connectionPair.pins.map((pin) => ({
          ...pin,
        })) as MspConnectionPair["pins"])
      : connectionPair.pins

    this.activeSubSolver = new SchematicTraceSingleLineSolver2({
      inputProblem: this.inputProblem,
      pins,
      connectionPair,
      chipMap: this.chipMap,
      preferExteriorDetours: shouldPreferExteriorDetours({
        connectionPair,
        allConnectionPairs: this.mspConnectionPairs,
        inputProblem: this.inputProblem,
      }),
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
