import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

test("external horizontal terminal has an outward connector to a ground label", async () => {
  const input: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2,
        height: 1,
        pins: [
          { pinId: "GND", x: -1.4, y: 0.1, _facingDirection: "x-" },
          { pinId: "VCC", x: -1.4, y: -0.1, _facingDirection: "x-" },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "GND",
        pinIds: ["GND"],
        isGround: true,
        netLabelWidth: 0.42,
        netLabelHeight: 0.48,
      },
    ],
    availableNetLabelOrientations: { GND: ["y-"] },
  }
  const solver = new SchematicTracePipelineSolver(input)
  solver.solve()
  const output = solver.netLabelToTraceSolver!.getOutput()
  const connector = output.traces.find((trace) => trace.pinIds.includes("GND"))!
  expect(connector).toBeDefined()
  const path = connector.tracePath
  expect(path[0]).toEqual({ x: -1.4, y: 0.1 })
  expect(path[1]!.x).toBeLessThan(-1.4)
  expect(path[1]!.y).toBeCloseTo(0.1)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
