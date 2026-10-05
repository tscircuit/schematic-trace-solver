import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Raw input from core's group-schematic-box-connected regression. The OUT pin
// extends 0.4 mm left of the actual box body; it must be approached from outside.
test("cleanup keeps the group box trace outside its port stem", async () => {
  const input: InputProblem = {
    chips: [
      {
        chipId: "G1",
        center: { x: 0, y: -1.74 },
        width: 1.4,
        height: 0.4,
        pins: [
          {
            pinId: "OUT",
            displayName: "OUT",
            x: -1.1,
            y: -1.74,
            _facingDirection: "x-",
          },
        ],
      },
      {
        chipId: "R_OUT",
        symbolName: "resistor",
        center: { x: 0, y: 0 },
        width: 0.6,
        height: 0.68,
        pins: [
          { pinId: "R_OUT.1", x: -0.3, y: 0, _facingDirection: "x-" },
          { pinId: "R_OUT.2", x: 0.3, y: 0, _facingDirection: "x+" },
        ],
      },
    ],
    directConnections: [{ pinIds: ["R_OUT.1", "OUT"] }],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const solver = new SchematicTracePipelineSolver(input)
  solver.solve()
  expect(solver.solved).toBe(true)
  const trace = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find(
      (trace) =>
        trace.pinIds.includes("OUT") && trace.pinIds.includes("R_OUT.1"),
    )!
  expect(trace).toBeDefined()
  const path =
    trace.tracePath[0]!.y === -1.74
      ? [...trace.tracePath].reverse()
      : trace.tracePath
  expect(path.at(-1)).toEqual({ x: -1.1, y: -1.74 })
  expect(path.at(-2)!.x).toBeLessThan(-1.1)
  expect(path.at(-2)!.y).toBe(-1.74)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
