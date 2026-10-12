import type { GraphicsObject, NinePointAnchor } from "graphics-debug"
import type { PinId, InputPin, InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { getPinDirection } from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import { arePinsInDifferentSchematicSections } from "../../utils/arePinsInDifferentSchematicSections"

export const visualizeInputProblem = (
  inputProblem: InputProblem,
  opts: {
    chipAlpha?: number
    connectionAlpha?: number
    hideRatsNet?: boolean
  } = {},
): GraphicsObject => {
  const {
    connectionAlpha = 0.8,
    chipAlpha = 0.8,
    hideRatsNet = inputProblem._hideRatsNet ?? false,
  } = opts
  const graphics: Pick<
    Required<GraphicsObject>,
    "lines" | "points" | "rects" | "texts"
  > = {
    lines: [],
    points: [],
    rects: [],
    texts: [],
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
        label: `${pin.displayName ?? pin.pinId}\n${pin._facingDirection ?? getPinDirection(pin, chip)}`,
        x: pin.x,
        y: pin.y,
        color: getColorFromString(pin.pinId, 0.8),
      })
    }
  }

  for (const textBox of inputProblem.textBoxes ?? []) {
    const placement = textBox.textPlacement
    graphics.rects.push({
      label: placement ? undefined : (textBox.text ?? "schematic_text"),
      center: textBox.center,
      width: textBox.width,
      height: textBox.height,
      fill: "rgba(160, 0, 220, 0.14)",
      strokeColor: "rgba(160, 0, 220, 0.9)",
    } as any)
    if (placement && textBox.text) {
      const anchorAliases: Record<string, NinePointAnchor> = {
        left: "center_left",
        right: "center_right",
        top: "top_center",
        bottom: "bottom_center",
      }
      graphics.texts.push({
        ...placement.position,
        text: textBox.text,
        anchorSide: anchorAliases[placement.anchor] ?? placement.anchor,
        fontSize: placement.fontSize,
        // graphics-debug uses counter-clockwise world rotation; Circuit JSON
        // schematic_text uses clockwise screen rotation.
        rotation: -(placement.rotation ?? 0),
        color: "#7e22ce",
      })
    }
  }

  if (!hideRatsNet) {
    for (const directConn of inputProblem.directConnections) {
      const [pinId1, pinId2] = directConn.pinIds
      const pin1 = pinIdMap.get(pinId1)!
      const pin2 = pinIdMap.get(pinId2)!
      if (arePinsInDifferentSchematicSections(inputProblem, pin1, pin2)) {
        continue
      }
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
      const pins = netConn.pinIds.map((pinId) => pinIdMap.get(pinId)!)
      for (let i = 0; i < pins.length - 1; i++) {
        for (let j = i + 1; j < pins.length; j++) {
          const pin1 = pins[i]!
          const pin2 = pins[j]!
          if (arePinsInDifferentSchematicSections(inputProblem, pin1, pin2)) {
            continue
          }
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
    }
  }

  return graphics
}
