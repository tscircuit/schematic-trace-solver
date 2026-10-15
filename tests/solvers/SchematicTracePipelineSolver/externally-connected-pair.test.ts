import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("does not recover a wire or inline stubs between caller-connected pins", () => {
  for (const distance of [1, 5]) {
    const input: InputProblem = {
      chips: [0, distance].map((x, index) => ({
        chipId: `chip${index}`,
        center: { x, y: 1 },
        width: 0.5,
        height: 1,
        pins: [{ pinId: `p${index}`, x, y: 0.5, _facingDirection: "y-" }],
      })),
      directConnections: [
        { pinIds: ["p0", "p1"], netId: "SIGNAL", allowInlineNetLabel: true },
      ],
      netConnections: [
        {
          pinIds: ["p0", "p1"],
          netId: "SIGNAL",
          allowInlineNetLabel: true,
          netLabelWidth: 1,
        },
      ],
      externallyConnectedPinIds: ["p0", "p1"],
      availableNetLabelOrientations: { SIGNAL: ["y-"] },
    }
    const solver = new SchematicTracePipelineSolver(input)
    solver.solve()
    expect(solver.solved).toBe(true)
    const output = solver.inlineNetLabelSolver!.getOutput()
    expect(output.traces).toEqual([])
    expect(output.netLabelPlacements).toEqual([])
    expect(output.inlineNetLabelPlacements).toEqual([])
  }
})
