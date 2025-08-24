import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { ConnectivityMap } from "connectivity-map"
import { getConnectivityMapsFromInputProblem } from "./getConnectivityMapFromInputProblem"
import { getOrthogonalMinimumSpanningTree } from "./getMspConnectionPairsFromPins"
import type { GraphicsObject } from "graphics-debug"
import { getColorFromString } from "lib/utils/getColorFromString"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

export type MspConnectionPair = {
  mspPairId: string
  dcConnNetId: string
  globalConnNetId: string
  pins: [InputPin & { chipId: string }, InputPin & { chipId: string }]
}

export class MspConnectionPairSolver extends BaseSolver {
  inputProblem: InputProblem

  mspConnectionPairs: MspConnectionPair[] = []
  dcConnMap: ConnectivityMap
  globalConnMap: ConnectivityMap
  queuedDcNetIds: string[]

  pinMap: Record<string, InputPin & { chipId: string }>

  constructor({ inputProblem }: { inputProblem: InputProblem }) {
    super()

    this.inputProblem = inputProblem

    const { directConnMap, netConnMap } =
      getConnectivityMapsFromInputProblem(inputProblem)
    this.dcConnMap = directConnMap
    this.globalConnMap = netConnMap

    this.pinMap = {}
    for (const chip of inputProblem.chips) {
      for (const pin of chip.pins) {
        this.pinMap[pin.pinId] = { ...pin, chipId: chip.chipId }
      }
    }

    this.queuedDcNetIds = Object.keys(directConnMap.netMap)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof MspConnectionPairSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
    }
  }

  override _step() {
    if (this.queuedDcNetIds.length === 0) {
      this.solved = true
      return
    }

    const dcNetId = this.queuedDcNetIds.shift()!

    const directlyConnectedPins = this.dcConnMap.getIdsConnectedToNet(dcNetId)

    if (directlyConnectedPins.length === 1) {
      return
    }

    if (directlyConnectedPins.length === 2) {
      const [pin1, pin2] = directlyConnectedPins

      this.mspConnectionPairs.push({
        mspPairId: `${pin1}-${pin2}`,
        dcConnNetId: dcNetId,
        globalConnNetId: this.globalConnMap.getNetConnectedToId(pin1!)!,
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
        dcConnNetId: dcNetId,
        globalConnNetId: this.globalConnMap.getNetConnectedToId(pin1!)!,
        pins: [this.pinMap[pin1!]!, this.pinMap[pin2!]!],
      })
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    // Draw all the solved MSP with lines, and the next-to-be-solved points with points
    for (const pair of this.mspConnectionPairs) {
      graphics.lines!.push({
        points: [
          {
            x: pair.pins[0].x,
            y: pair.pins[0].y,
          },
          {
            x: pair.pins[1].x,
            y: pair.pins[1].y,
          },
        ],
        strokeColor: getColorFromString(pair.mspPairId, 0.75),
      })
    }

    return graphics
  }
}
