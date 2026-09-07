import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InlineNetLabelPlacement } from "./InlineNetLabelSolver"

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
    const id = `inline-terminal-${`${label.globalConnNetId}-${label.pinIds.join("-")}`}`
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
