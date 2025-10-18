import type { GraphicsObject } from "graphics-debug"
import type { PinId, InputPin, InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { getPinDirection } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"

export const visualizeInputProblem = (
  inputProblem: InputProblem,
  opts: {
    chipAlpha?: number
    connectionAlpha?: number
  } = {},
): GraphicsObject => {
  const { connectionAlpha = 0.8, chipAlpha = 0.8 } = opts
  const graphics: Pick<
    Required<GraphicsObject>,
    "lines" | "points" | "rects"
  > = {
    lines: [],
    points: [],
    rects: [],
  }

  const pinIdMap = new Map<PinId, InputPin>()
  for (const chip of inputProblem.chips) {
    for (const pin of chip.pins) {
      pinIdMap.set(pin.pinId, pin)
    }
  }

  for (const chip of inputProblem.chips) {
    graphics.rects.push({
      label: chip.chipId,
      center: chip.center,
      width: chip.width,
      height: chip.height,
      fill: getColorFromString(chip.chipId, chipAlpha),
    })

    for (const pin of chip.pins) {
      graphics.points.push({
        label: `${pin.pinId}\n${pin._facingDirection ?? getPinDirection(pin, chip)}`,
        x: pin.x,
        y: pin.y,
        color: getColorFromString(pin.pinId, 0.8),
      })
    }
  }

  for (const directConn of inputProblem.directConnections) {
    const [pinId1, pinId2] = directConn.pinIds
    const pin1 = pinIdMap.get(pinId1)!
    const pin2 = pinIdMap.get(pinId2)!
    graphics.lines.push({
      points: [
        {
          x: pin1.x,
          y: pin1.y,
        },
        {
          x: pin2.x,
          y: pin2.y,
        },
      ],
      strokeColor: getColorFromString(
        directConn.netId ?? `${pinId1}-${pinId2}`,
        connectionAlpha,
      ),
    })
  }

  for (const netConn of inputProblem.netConnections) {
    // For each net, only connect adjacent pins in the array
    // This avoids creating a fully connected-graph for nets
    const pins = netConn.pinIds.map((pinId) => pinIdMap.get(pinId)!)
    for (let i = 0; i < pins.length - 1; i++) {
      const pin1 = pins[i]!
      const pin2 = pins[i + 1]!
      graphics.lines.push({
        points: [
          { x: pin1.x, y: pin1.y },
          { x: pin2.x, y: pin2.y },
        ],
        strokeColor: getColorFromString(netConn.netId, connectionAlpha),
        strokeDash: "4 2",
      })
    }
  }

  return graphics
}
