import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

/** A terminal wire is separate from remote routes, even on the same net. */
export const getInlineTerminalBounds = (label: InlineNetLabelPlacement) => {
  if (!label.stubTracePath) return null
  // Give a line a nonzero box for the axis-aligned rectangle intersection test.
  const epsilon = 1e-6
  return {
    minX: Math.min(...label.stubTracePath.map((p) => p.x)) - epsilon,
    maxX: Math.max(...label.stubTracePath.map((p) => p.x)) + epsilon,
    minY: Math.min(...label.stubTracePath.map((p) => p.y)) - epsilon,
    maxY: Math.max(...label.stubTracePath.map((p) => p.y)) + epsilon,
  }
}

/** Geometric obstacles for already placed inline text and its terminal wires. */
export const getInlineLabelObstacles = (
  inputProblem: InputProblem,
  placements: InlineNetLabelPlacement[],
) => {
  const fixedLabels: NetLabelPlacement[] = placements.map((label) => ({
    globalConnNetId: label.globalConnNetId,
    netId: label.netId,
    pinIds: label.pinIds,
    mspConnectionPairIds: [],
    anchorPoint: label.anchorPoint,
    orientation: "y+",
    center: label.center,
    width: label.axis === "x" ? label.width : label.height,
    height: label.axis === "x" ? label.height : label.width,
  }))
  const terminalTraces: SolvedTracePath[] = placements.flatMap((label) => {
    if (!label.stubTracePath) return []
    const chip = inputProblem.chips.find((chip) =>
      chip.pins.some((pin) => label.pinIds.includes(pin.pinId)),
    )
    const pin = chip?.pins.find((pin) => label.pinIds.includes(pin.pinId))
    if (!chip || !pin) return []
    const id = JSON.stringify([
      "inline-terminal",
      label.globalConnNetId,
      [...label.pinIds].sort(),
    ])
    return [
      {
        mspPairId: id,
        mspConnectionPairIds: [id],
        globalConnNetId: label.globalConnNetId,
        dcConnNetId: label.globalConnNetId,
        pinIds: label.pinIds,
        pins: [
          { ...pin, chipId: chip.chipId },
          { ...pin, ...label.stubTracePath[1], chipId: chip.chipId },
        ],
        tracePath: label.stubTracePath,
      },
    ]
  })

  return { fixedLabels, terminalTraces }
}
