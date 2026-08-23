import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Extracted from TI TIDA-010076 sheet 2, connector J4. In the reference
// schematic, pins 3-6 join one vertical bus that terminates in one AGND symbol.
// The tscircuit rendering instead splits the four adjacent ground pins into
// separate branches before placing the ground label.
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "J4",
      center: { x: 0, y: 0 },
      width: 1.55,
      height: 2.9,
      pins: [
        { pinId: "J4.1", x: 0.775, y: 1.1, _facingDirection: "x+" },
        { pinId: "J4.2", x: 0.775, y: 0.7, _facingDirection: "x+" },
        { pinId: "J4.3", x: 0.775, y: 0.1, _facingDirection: "x+" },
        { pinId: "J4.4", x: 0.775, y: -0.3, _facingDirection: "x+" },
        { pinId: "J4.5", x: 0.775, y: -0.7, _facingDirection: "x+" },
        { pinId: "J4.6", x: 0.775, y: -1.1, _facingDirection: "x+" },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "NET_AGND",
      pinIds: ["J4.3", "J4.4", "J4.5", "J4.6"],
      netLabelWidth: 0.42,
      netLabelHeight: 1.08,
    },
  ],
  textBoxes: [
    {
      chipId: "J4",
      center: { x: 0.285, y: -1.58 },
      width: 1.32,
      height: 0.18,
      text: "09452812800",
    },
    {
      chipId: "J4",
      center: { x: -0.255, y: 1.565 },
      width: 0.36,
      height: 0.25,
      text: "J4",
    },
  ],
  availableNetLabelOrientations: { NET_AGND: ["y-"] },
  maxMspPairDistance: 2.4,
}

test("repro TIDA-010076 J4 ground pins should share one vertical bus", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const groundTraces = output.traces.filter(
    (trace) =>
      trace.userNetId === "NET_AGND" &&
      trace.pinIds.every((pinId) => pinId.startsWith("J4.")),
  )
  const verticalBranchOffsets = new Set(
    groundTraces.map((trace) => trace.tracePath[1]!.x.toFixed(3)),
  )

  // Current mismatch: the first three GND pins use one vertical offset while
  // the final pair detours around the manufacturer text at a second offset.
  expect(verticalBranchOffsets.size).toBe(2)
  expect(
    output.netLabelPlacements.filter((label) => label.netId === "NET_AGND"),
  ).toHaveLength(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
