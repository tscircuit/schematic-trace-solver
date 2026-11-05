import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { moveCrossedPortLabelsOutward } from "lib/solvers/RailNetLabelCornerPlacementSolver/moveCrossedPortLabelsOutward"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = (xSign = 1, ySign = 1) => {
  const point = (x: number, y: number) => ({ x: x * xSign, y: y * ySign })
  const orientation = ySign === 1 ? "y+" : "y-"
  const pins = [
    { pinId: "U.A", chipId: "U", ...point(0, 0) },
    { pinId: "U.B", chipId: "U", ...point(0, -0.4) },
  ]
  const inputProblem: InputProblem = {
    chips: [{ chipId: "U", center: point(0.5, 0), width: 1, height: 2, pins }],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "A",
      netId: "A",
      pinIds: ["U.A"],
      mspConnectionPairIds: [],
      orientation,
      anchorPoint: point(-1.5, 0.6),
      center: point(-1.5, 0.8),
      width: 1,
      height: 0.4,
    },
    {
      globalConnNetId: "B",
      netId: "B",
      pinIds: ["U.B"],
      mspConnectionPairIds: [],
      orientation,
      anchorPoint: point(-1.8, -0.1),
      center: point(-1.8, 0.1),
      width: 1,
      height: 0.4,
    },
  ]
  const traces: SolvedTracePath[] = pins.map((pin, index) => ({
    mspPairId: `connector-${index}`,
    mspConnectionPairIds: [`connector-${index}`],
    globalConnNetId: netLabelPlacements[index]!.globalConnNetId,
    dcConnNetId: netLabelPlacements[index]!.globalConnNetId,
    pins: [pin, pin],
    pinIds: [pin.pinId],
    tracePath: [
      point(0, index === 0 ? 0 : -0.4),
      point(index === 0 ? -1.5 : -1.8, index === 0 ? 0 : -0.4),
      netLabelPlacements[index]!.anchorPoint,
    ],
  }))
  traces.push({
    ...traces[0]!,
    mspPairId: "rail",
    mspConnectionPairIds: ["rail"],
    globalConnNetId: "rail",
    dcConnNetId: "rail",
    pinIds: [],
    tracePath: [point(0, 0.8), point(-2, 0.8), point(-2, 3), point(0, 3)],
  })
  return {
    inputProblem,
    traces,
    netLabelPlacements,
    netLabelConnectorTraceIds: new Set(["connector-0", "connector-1"]),
    labelIndex: 0,
  }
}

for (const xSign of [-1, 1]) {
  for (const ySign of [-1, 1]) {
    test(`moves a crossed terminal label and its blocking neighbor: ${xSign}, ${ySign}`, () => {
      const fixture = createFixture(xSign, ySign)
      const before = structuredClone(fixture)
      const output = moveCrossedPortLabelsOutward(fixture)!
      expect(output).not.toBeNull()
      expect(output.netLabelPlacements[0]!.anchorPoint.x * xSign).toBeLessThan(
        -2.5,
      )
      expect(output.netLabelPlacements[1]!.anchorPoint.x * xSign).toBeLessThan(
        output.netLabelPlacements[0]!.anchorPoint.x * xSign,
      )
      expect(
        detectTraceLabelOverlap({
          traces: output.traces,
          netLabels: output.netLabelPlacements,
        }),
      ).toHaveLength(0)
      for (let index = 0; index < 2; index++) {
        expect(output.traces[index]!.tracePath[0]).toEqual(
          before.traces[index]!.tracePath[0],
        )
        expect(
          tracePathContainsPoint(
            output.traces[index]!.tracePath,
            output.netLabelPlacements[index]!.anchorPoint,
          ),
        ).toBe(true)
      }
      expect(output.traces[2]).toEqual(before.traces[2])
      expect(fixture).toEqual(before)
      expect(moveCrossedPortLabelsOutward({ ...fixture, ...output })).toBeNull()
    })
  }
}

for (const obstruction of ["junction", "fixed neighbor", "new crossing"]) {
  test(`does not move the group across a ${obstruction}`, () => {
    const fixture = createFixture()
    if (obstruction === "fixed neighbor")
      fixture.netLabelConnectorTraceIds.delete("connector-1")
    else
      fixture.traces.push({
        ...fixture.traces[0]!,
        mspPairId: "obstruction",
        globalConnNetId: obstruction === "junction" ? "A" : "other",
        tracePath:
          obstruction === "junction"
            ? [
                { x: -1.5, y: 0.3 },
                { x: -2, y: 0.3 },
              ]
            : [
                { x: -2.3, y: -0.2 },
                { x: -2.3, y: 0.2 },
              ],
      })
    const before = structuredClone(fixture)
    expect(moveCrossedPortLabelsOutward(fixture)).toBeNull()
    expect(fixture).toEqual(before)
  })
}
