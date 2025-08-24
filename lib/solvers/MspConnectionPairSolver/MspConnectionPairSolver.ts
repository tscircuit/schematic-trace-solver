import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { ConnectivityMap } from "connectivity-map"
import { getConnectivityMapsFromInputProblem } from "./getConnectivityMapFromInputProblem"
import { getOrthogonalMinimumSpanningTree } from "./getMspConnectionPairsFromPins"
import type { GraphicsObject } from "graphics-debug"

export type MspConnectionPair = {
  mspPairId: string
  pins: [InputPin & { chipId: string }, InputPin & { chipId: string }]
}

export class MspConnectionPairSolver extends BaseSolver {
  inputProblem: InputProblem

  mspConnectionPairs: MspConnectionPair[] = []
  directConnMap: ConnectivityMap
  netConnMap: ConnectivityMap
  queuedNetIds: string[]

  pinMap: Record<string, InputPin & { chipId: string }>

  constructor({ inputProblem }: { inputProblem: InputProblem }) {
    super()

    this.inputProblem = inputProblem

    const { directConnMap, netConnMap } =
      getConnectivityMapsFromInputProblem(inputProblem)
    this.directConnMap = directConnMap
    this.netConnMap = netConnMap

    this.pinMap = {}
    for (const chip of inputProblem.chips) {
      for (const pin of chip.pins) {
        this.pinMap[pin.pinId] = { ...pin, chipId: chip.chipId }
      }
    }

    this.queuedNetIds = Object.keys(netConnMap.netMap)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof MspConnectionPairSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
    }
  }

  override _step() {
    if (this.queuedNetIds.length === 0) {
      this.solved = true
      return
    }

    const netId = this.queuedNetIds.shift()!

    const directlyConnectedPins = this.directConnMap.getIdsConnectedToNet(netId)

    if (directlyConnectedPins.length === 1) {
      return
    }

    if (directlyConnectedPins.length === 2) {
      const [pin1, pin2] = directlyConnectedPins

      this.mspConnectionPairs.push({
        mspPairId: `${pin1}-${pin2}`,
        pins: [this.pinMap[pin1!]!, this.pinMap[pin2!]!],
      })

      return
    }

    // There are more than 3 pins, so we need to run MSP to find the best pairs

    const msp = getOrthogonalMinimumSpanningTree(
      directlyConnectedPins.map((p) => this.pinMap[p]!),
    )

    for (const [pin1, pin2] of msp) {
      this.mspConnectionPairs.push({
        mspPairId: `${pin1}-${pin2}`,
        pins: [this.pinMap[pin1!]!, this.pinMap[pin2!]!],
      })
    }
  }

  override visualize(): GraphicsObject {
    const graphics: Pick<Required<GraphicsObject>, "points" | "lines"> = {
      points: [],
      lines: [],
    }

    // Draw all the solved MSP with lines, and the next-to-be-solved points with points
    for (const pair of this.mspConnectionPairs) {
    }

    return graphics
  }
}
