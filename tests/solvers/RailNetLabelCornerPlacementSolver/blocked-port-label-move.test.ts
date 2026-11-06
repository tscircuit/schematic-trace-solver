import { expect, test } from "bun:test"
import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import { createCrossedPortLabelsFixture } from "./fixtures/crossedPortLabels"

test.each(["junction", "fixed neighbor", "new crossing"] as const)(
  "preserves the port connector blocked by a %s",
  (obstruction) => {
    const input = createCrossedPortLabelsFixture()
    if (obstruction === "fixed neighbor") {
      input.netLabelConnectorTraceIds.delete("connector-1")
    } else {
      input.traces.push({
        ...input.traces[0]!,
        mspPairId: "obstruction",
        globalConnNetId: obstruction === "junction" ? "A" : "other",
        tracePath:
          obstruction === "junction"
            ? [
                { x: -2, y: 0.05 },
                { x: -2.5, y: 0.05 },
              ]
            : [
                { x: -3.3, y: -0.2 },
                { x: -3.3, y: 0.2 },
              ],
      })
    }
    const before = structuredClone(input)
    const solver = new RailNetLabelCornerPlacementSolver(input)
    solver.solve()
    const output = solver.getOutput()

    expect(output.netLabelPlacements[0]).toEqual(before.netLabelPlacements[0])
    expect(output.traces[0]).toEqual(before.traces[0])
    expect(output.traces.slice(2)).toEqual(before.traces.slice(2))
    expect(
      countPathIntersections(
        output.traces[1]!.tracePath,
        output.traces.at(-1)!.tracePath,
      ),
    ).toBeLessThanOrEqual(
      countPathIntersections(
        before.traces[1]!.tracePath,
        before.traces.at(-1)!.tracePath,
      ),
    )
    if (obstruction === "fixed neighbor")
      expect(output.netLabelPlacements).toEqual(before.netLabelPlacements)
    expect(input).toEqual(before)
  },
)
