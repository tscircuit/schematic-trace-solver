import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "R8",
      center: { x: -7, y: -19 },
      width: 0.6,
      height: 0.65,
      pins: [
        { pinId: "R8.pin1", x: -7.3, y: -19, _facingDirection: "x-" },
        { pinId: "R8.pin2", x: -6.7, y: -19, _facingDirection: "x+" },
      ],
    },
    {
      chipId: "R7",
      center: { x: -5, y: -19 },
      width: 0.6,
      height: 0.65,
      pins: [
        { pinId: "R7.pin1", x: -5.3, y: -19, _facingDirection: "x-" },
        { pinId: "R7.pin2", x: -4.7, y: -19, _facingDirection: "x+" },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "V3V3",
      netLabelText: "V3V3",
      pinIds: ["R8.pin2", "R7.pin2"],
      netLabelWidth: 0.48,
      netLabelHeight: 0.42,
    },
    {
      netId: "U1_IO22",
      netLabelText: "U1_IO22",
      pinIds: ["R8.pin1"],
      netLabelWidth: 0.84,
      netLabelHeight: 0.42,
    },
    {
      netId: "U1_IO21",
      netLabelText: "U1_IO21",
      pinIds: ["R7.pin1"],
      netLabelWidth: 1,
      netLabelHeight: 0.42,
    },
  ],
  availableNetLabelOrientations: {
    V3V3: ["y+"],
    U1_IO22: ["x-"],
    U1_IO21: ["x-"],
  },
  maxMspPairDistance: 2.4,
}

test("repro: V3V3 net-label branch does not start at the R8 edge", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements,
  ).not.toHaveLength(0)
  expect(
    solver.inlineNetLabelSolver!.getOutput().inlineNetLabelPlacements,
  ).toHaveLength(0)
  const v3v3Connector = solver
    .sameNetJunctionAlignmentSolver!.getOutput()
    .traces.find(
      (trace) => trace.userNetId === "V3V3" && trace.isAvailableNetOrientation,
    )
  expect(v3v3Connector?.tracePath[0]).toEqual({ x: -6.7, y: -19 })
  expect(v3v3Connector?.tracePath[1]).toEqual({ x: -6.34, y: -19 })
  expect(
    solver
      .sameNetJunctionAlignmentSolver!.getOutput()
      .netLabelPlacements.find((label) => label.netId === "V3V3")?.anchorPoint
      .x,
  ).toBe(-6.34)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
