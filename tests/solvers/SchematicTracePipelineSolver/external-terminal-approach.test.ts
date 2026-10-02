import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

test.each([0, 1, 2, 3])(
  "cleanup preserves outward approaches at external terminals after %i quarter turns",
  async (turns) => {
    const input: InputProblem = {
      chips: [
        {
          chipId: "GROUP",
          center: { x: 0, y: -1.74 },
          width: 1.4,
          height: 0.4,
          pins: [{ pinId: "OUT", x: -1.1, y: -1.74, _facingDirection: "x-" }],
        },
        {
          chipId: "R",
          center: { x: 0, y: 0 },
          width: 0.6,
          height: 0.16,
          pins: [{ pinId: "IN", x: -0.3, y: 0, _facingDirection: "x-" }],
        },
      ],
      directConnections: [{ pinIds: ["IN", "OUT"] }],
      netConnections: [],
      availableNetLabelOrientations: {},
    }
    for (let turn = 0; turn < turns; turn++) {
      for (const chip of input.chips) {
        chip.center = { x: -chip.center.y, y: chip.center.x }
        ;[chip.width, chip.height] = [chip.height, chip.width]
        for (const pin of chip.pins) {
          ;[pin.x, pin.y] = [-pin.y, pin.x]
          pin._facingDirection = (
            { "x-": "y-", "y-": "x+", "x+": "y+", "y+": "x-" } as const
          )[pin._facingDirection!]
        }
      }
    }
    const solver = new SchematicTracePipelineSolver(input)
    solver.solve()
    const trace = solver
      .netLabelToTraceSolver!.getOutput()
      .traces.find((t) => t.pinIds.includes("IN") && t.pinIds.includes("OUT"))!
    expect(trace).toBeDefined()
    for (const pin of input.chips.flatMap((chip) => chip.pins)) {
      const path =
        Math.hypot(
          trace.tracePath[0]!.x - pin.x,
          trace.tracePath[0]!.y - pin.y,
        ) < 1e-8
          ? trace.tracePath
          : [...trace.tracePath].reverse()
      expect(path[0]!.x).toBeCloseTo(pin.x)
      expect(path[0]!.y).toBeCloseTo(pin.y)
      const vector = (
        {
          "x-": { x: -1, y: 0 },
          "y-": { x: 0, y: -1 },
          "x+": { x: 1, y: 0 },
          "y+": { x: 0, y: 1 },
        } as const
      )[pin._facingDirection!]
      expect(
        (path[1]!.x - pin.x) * vector.x + (path[1]!.y - pin.y) * vector.y,
      ).toBeGreaterThan(0)
    }
    await expect(solver).toMatchSolverSnapshot(
      import.meta.path,
      `external-terminal-approach-${turns * 90}`,
    )
  },
)
