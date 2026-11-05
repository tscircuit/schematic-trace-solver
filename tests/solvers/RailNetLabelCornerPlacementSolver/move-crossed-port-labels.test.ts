import { expect, test } from "bun:test"
import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { rectsOverlap } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
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
      anchorPoint: point(-2, 0.1),
      center: point(-2, 0.3),
      width: 1,
      height: 0.4,
    },
    {
      globalConnNetId: "B",
      netId: "B",
      pinIds: ["U.B"],
      mspConnectionPairIds: [],
      orientation,
      anchorPoint: point(-0.6, -0.1),
      center: point(-0.6, 0.1),
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
      point(index === 0 ? -2 : -0.6, index === 0 ? 0 : -0.4),
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
    tracePath: [point(0, 0.3), point(-3, 0.3), point(-3, 3), point(0, 3)],
  })
  return {
    inputProblem,
    traces,
    netLabelPlacements,
    netLabelConnectorTraceIds: new Set(["connector-0", "connector-1"]),
    onlyOverlappingLabels: true,
  }
}

for (const xSign of [-1, 1]) {
  for (const ySign of [-1, 1]) {
    for (const reverse of [false, true]) {
      test(`moves overlapping port labels: ${xSign}, ${ySign}, reversed=${reverse}`, () => {
        const fixture = createFixture(xSign, ySign)
        if (reverse) {
          fixture.netLabelPlacements.reverse()
          fixture.traces.reverse()
          for (const trace of fixture.traces) trace.tracePath.reverse()
        }
        const before = structuredClone(fixture)
        const solver = new RailNetLabelCornerPlacementSolver(fixture)
        solver.solve()
        expect(solver.solved).toBe(true)
        const output = solver.getOutput()
        const labels = ["A", "B"].map(
          (netId) =>
            output.netLabelPlacements.find((label) => label.netId === netId)!,
        )
        expect(labels[0]!.anchorPoint.x * xSign).toBeLessThan(-3.5)
        expect(labels[1]!.anchorPoint.x * xSign).toBeLessThan(
          labels[0]!.anchorPoint.x * xSign,
        )
        expect(
          detectTraceLabelOverlap({
            traces: output.traces,
            netLabels: output.netLabelPlacements,
          }),
        ).toHaveLength(0)
        const bounds = output.netLabelPlacements.map((label) =>
          getRectBounds(label.center, label.width, label.height),
        )
        expect(rectsOverlap(bounds[0]!, bounds[1]!)).toBe(false)
        for (let index = 0; index < 2; index++) {
          const connector = output.traces.find(
            (trace) => trace.mspPairId === `connector-${index}`,
          )!
          expect(
            tracePathContainsPoint(
              connector.tracePath,
              fixture.inputProblem.chips[0]!.pins[index]!,
            ),
          ).toBe(true)
          expect(
            tracePathContainsPoint(
              connector.tracePath,
              labels[index]!.anchorPoint,
            ),
          ).toBe(true)
        }
        expect(
          output.traces.find((trace) => trace.mspPairId === "rail"),
        ).toEqual(before.traces.find((trace) => trace.mspPairId === "rail"))
        expect(fixture).toEqual(before)
        const replay = new RailNetLabelCornerPlacementSolver({
          ...fixture,
          ...output,
        })
        replay.solve()
        expect(replay.getOutput()).toEqual(output)
      })
    }
  }
}

for (const obstruction of ["junction", "fixed neighbor", "new crossing"]) {
  test(`preserves the blocked connector with a ${obstruction}`, () => {
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
                { x: -2, y: 0.05 },
                { x: -2.5, y: 0.05 },
              ]
            : [
                { x: -3.3, y: -0.2 },
                { x: -3.3, y: 0.2 },
              ],
      })
    const before = structuredClone(fixture)
    const solver = new RailNetLabelCornerPlacementSolver(fixture)
    solver.solve()
    const output = solver.getOutput()
    expect(output.netLabelPlacements[0]).toEqual(before.netLabelPlacements[0])
    expect(output.traces[0]).toEqual(before.traces[0])
    expect(output.traces.slice(2)).toEqual(before.traces.slice(2))
    for (let i = 0; i < output.traces.length; i++) {
      for (let j = i + 1; j < output.traces.length; j++) {
        if (
          output.traces[i]!.globalConnNetId ===
          output.traces[j]!.globalConnNetId
        )
          continue
        expect(
          countPathIntersections(
            output.traces[i]!.tracePath,
            output.traces[j]!.tracePath,
          ),
        ).toBeLessThanOrEqual(
          countPathIntersections(
            before.traces[i]!.tracePath,
            before.traces[j]!.tracePath,
          ),
        )
      }
    }
    if (obstruction === "fixed neighbor")
      expect(output.netLabelPlacements).toEqual(before.netLabelPlacements)
    expect(fixture).toEqual(before)
  })
}

test("resolves a chain of neighboring connectors in either label order", () => {
  for (const reverse of [false, true]) {
    const fixture = createFixture()
    const pin = { pinId: "U.C", chipId: "U", x: 0, y: -0.8 }
    fixture.inputProblem.chips[0]!.pins.push(pin)
    const label: NetLabelPlacement = {
      ...fixture.netLabelPlacements[1]!,
      globalConnNetId: "C",
      netId: "C",
      pinIds: [pin.pinId],
      anchorPoint: { x: -0.8, y: -0.5 },
      center: { x: -0.8, y: -0.1 },
      height: 0.8,
    }
    fixture.netLabelPlacements.push(label)
    fixture.traces.push({
      ...fixture.traces[1]!,
      mspPairId: "connector-2",
      mspConnectionPairIds: ["connector-2"],
      globalConnNetId: "C",
      dcConnNetId: "C",
      pinIds: [pin.pinId],
      pins: [pin, pin],
      tracePath: [pin, { x: -0.8, y: pin.y }, label.anchorPoint],
    })
    fixture.netLabelConnectorTraceIds.add("connector-2")
    if (reverse) fixture.netLabelPlacements.reverse()
    const solver = new RailNetLabelCornerPlacementSolver(fixture)
    solver.solve()
    const output = solver.getOutput()
    expect(solver.solved).toBe(true)
    expect(
      detectTraceLabelOverlap({
        traces: output.traces,
        netLabels: output.netLabelPlacements,
      }),
    ).toHaveLength(0)
    const bounds = output.netLabelPlacements.map((label) =>
      getRectBounds(label.center, label.width, label.height),
    )
    for (let i = 0; i < bounds.length; i++) {
      for (let j = i + 1; j < bounds.length; j++) {
        expect(rectsOverlap(bounds[i]!, bounds[j]!)).toBe(false)
      }
    }
    for (const label of output.netLabelPlacements) {
      const connector = output.traces.find(
        (trace) => trace.globalConnNetId === label.globalConnNetId,
      )!
      expect(
        tracePathContainsPoint(connector.tracePath, label.anchorPoint),
      ).toBe(true)
      expect(
        tracePathContainsPoint(connector.tracePath, connector.pins[0]),
      ).toBe(true)
    }
  }
})
