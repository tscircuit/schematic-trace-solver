import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("keeps caller-connected branches separate and labels only unreached terminals", () => {
  const input: InputProblem = {
    chips: [-3, -1.5, 1.5, 3, 10].map((x, index) => ({
      chipId: `chip${index}`,
      center: { x, y: 1 },
      width: 0.8,
      height: 1,
      sectionId: index === 4 ? "remote" : "local",
      pins: [
        {
          pinId: `p${index}`,
          displayName: `P${index}`,
          x,
          y: 0.5,
          _facingDirection: "y-",
        },
      ],
    })),
    directConnections: [],
    netConnections: [
      {
        netId: "RETURN",
        isGround: true,
        pinIds: ["p0", "p1", "p2", "p3", "p4"],
        netLabelWidth: 0.42,
        netLabelHeight: 0.6,
      },
    ],
    externallyConnectedPinIds: ["p0", "p3"],
    availableNetLabelOrientations: { RETURN: ["y-"] },
    maxMspPairDistance: 2.4,
  }
  const solver = new SchematicTracePipelineSolver(structuredClone(input))
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(
    solver.mspConnectionPairSolver!.mspConnectionPairs.map((p) =>
      p.pins.map((p) => p.pinId),
    ),
  ).toEqual([
    ["p1", "p0"],
    ["p2", "p3"],
  ])
  const output = solver.inlineNetLabelSolver!.getOutput()
  expect(output.traces.map((t) => t.pinIds)).toEqual([
    ["p1", "p0"],
    ["p2", "p3"],
  ])
  expect(output.netLabelPlacements.flatMap((p) => p.pinIds)).toEqual(["p4"])
})
