import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test.each(["CLOCK", ".A > .B"])(
  "a named net and its direct pair %s produce one inline label",
  (directName) => {
    const connection = {
      netId: "CLOCK",
      pinIds: ["A.1", "B.1"] as [string, string],
      allowInlineNetLabel: true,
      inlineNetLabelWidth: 0.5,
      inlineNetLabelHeight: 0.12,
    }
    const input: InputProblem = {
      chips: [
        {
          chipId: "A",
          center: { x: 0, y: 0 },
          width: 1,
          height: 1,
          pins: [{ pinId: "A.1", x: 0.5, y: 0 }],
        },
        {
          chipId: "B",
          center: { x: 3, y: 0 },
          width: 1,
          height: 1,
          pins: [{ pinId: "B.1", x: 2.5, y: 0 }],
        },
      ],
      directConnections: [{ ...connection, netId: directName }],
      netConnections: [connection],
      availableNetLabelOrientations: {},
    }
    const trace: SolvedTracePath = {
      mspPairId: "pair",
      mspConnectionPairIds: ["pair"],
      globalConnNetId: "CLOCK",
      dcConnNetId: "CLOCK",
      pinIds: connection.pinIds,
      pins: [
        { pinId: "A.1", chipId: "A", x: 0.5, y: 0 },
        { pinId: "B.1", chipId: "B", x: 2.5, y: 0 },
      ],
      tracePath: [
        { x: 0.5, y: 0 },
        { x: 2.5, y: 0 },
      ],
    }
    const solver = new InlineNetLabelSolver({
      inputProblem: input,
      traces: [trace],
      netLabelPlacements: [],
    })
    solver.solve()
    expect(solver.getOutput().inlineNetLabelPlacements).toHaveLength(1)
    expect(solver.getOutput().inlineNetLabelPlacements[0]!.netId).toBe("CLOCK")
    expect(solver.getOutput().traces).toEqual([trace])
  },
)
