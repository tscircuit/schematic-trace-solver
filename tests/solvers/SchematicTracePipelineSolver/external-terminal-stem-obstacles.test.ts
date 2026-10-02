import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

test("label detours avoid supplied port stems without enlarging the body", async () => {
  const input: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 3,
        height: 8,
        pins: [
          {
            pinId: "A",
            x: -1.9,
            y: 3,
            stemEnd: { x: -1.5, y: 3 },
            _facingDirection: "x-",
          },
          {
            pinId: "MID",
            x: -1.9,
            y: 0,
            stemEnd: { x: -1.5, y: 0 },
            _facingDirection: "x-",
          },
          {
            pinId: "B",
            x: -1.9,
            y: -3,
            stemEnd: { x: -1.5, y: -3 },
            _facingDirection: "x-",
          },
        ],
      },
    ],
    directConnections: [{ pinIds: ["A", "B"], netId: "POWER" }],
    netConnections: [
      {
        netId: "SIGNAL",
        pinIds: ["MID"],
        netLabelWidth: 1.2,
        allowInlineNetLabel: true,
      },
    ],
    availableNetLabelOrientations: { SIGNAL: ["x-"] },
    maxMspPairDistance: 10,
  }
  const solver = new SchematicTracePipelineSolver(input)
  solver.solve()
  expect(solver.inputProblem.chips[0]!.width).toBe(3)
  const trace = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find((t) => t.pinIds.includes("A") && t.pinIds.includes("B"))!
  expect(trace).toBeDefined()
  // The middle port's actual drawn stem runs from x=-1.9 to -1.5 at y=0.
  // A label detour must pass outside its terminal, never behind it.
  const crossingSegments = trace.tracePath.slice(1).flatMap((b, i) => {
    const a = trace.tracePath[i]!
    return Math.min(a.y, b.y) < 0 && Math.max(a.y, b.y) > 0 ? [{ a, b }] : []
  })
  expect(crossingSegments.length).toBeGreaterThan(0)
  for (const { a, b } of crossingSegments) {
    expect(a.x).toBeLessThan(-1.9)
    expect(b.x).toBeLessThan(-1.9)
  }
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
