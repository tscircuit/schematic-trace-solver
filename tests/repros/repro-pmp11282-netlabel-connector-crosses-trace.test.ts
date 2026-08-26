import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import type { InputProblem } from "lib/types/InputProblem"
import pmpInputJson from "./assets/repro-pmp11282-isolated-dcdc.input.json"
import "tests/fixtures/matcher"

// Exact subset of the PMP11282 reproduction around the V20V2 label and the
// nearby routed corridor. The orientation-correction connector from
// schematic_port_97 crosses the schematic_port_275-to-131 trace.
const pmpInput = pmpInputJson as unknown as InputProblem
const directPinPairs = [
  ["schematic_port_51", "schematic_port_120"],
  ["schematic_port_50", "schematic_port_127"],
  ["schematic_port_96", "schematic_port_128"],
  ["schematic_port_53", "schematic_port_51"],
  ["schematic_port_275", "schematic_port_131"],
]
const includedPinIds = new Set([
  ...directPinPairs.flat(),
  "schematic_port_25",
  "schematic_port_97",
  "schematic_port_257",
])
const includedChipIds = new Set(
  pmpInput.chips
    .filter((chip) => chip.pins.some((pin) => includedPinIds.has(pin.pinId)))
    .map((chip) => chip.chipId),
)
const pairKey = (pinIds: string[]) => [...pinIds].sort().join("::")
const directPairKeys = new Set(directPinPairs.map(pairKey))
const inputProblem: InputProblem = {
  chips: pmpInput.chips.filter((chip) => includedChipIds.has(chip.chipId)),
  directConnections: pmpInput.directConnections.filter((connection) =>
    directPairKeys.has(pairKey(connection.pinIds)),
  ),
  netConnections: [
    {
      ...pmpInput.netConnections.find(
        (connection) => connection.netId === "V20V2",
      )!,
      pinIds: ["schematic_port_97"],
    },
    {
      ...pmpInput.netConnections.find(
        (connection) => connection.netId === "SGND",
      )!,
      pinIds: ["schematic_port_257", "schematic_port_25"],
    },
  ],
  textBoxes: (pmpInput.textBoxes ?? []).filter((textBox) =>
    textBox.chipId ? includedChipIds.has(textBox.chipId) : false,
  ),
  availableNetLabelOrientations: {
    V20V2: pmpInput.availableNetLabelOrientations.V20V2!,
    SGND: pmpInput.availableNetLabelOrientations.SGND!,
  },
  maxMspPairDistance: pmpInput.maxMspPairDistance,
}

test("PMP11282 V20V2 label connector avoids a different-net trace", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const labelConnector = output.traces.find((trace) =>
    trace.mspPairId.startsWith("available-net-orientation-"),
  )!
  const crossedTrace = output.traces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_275") &&
      trace.pinIds.includes("schematic_port_131"),
  )!

  expect(
    findPerpendicularPathCrossings(
      labelConnector.tracePath,
      crossedTrace.tracePath,
    ),
  ).toHaveLength(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
