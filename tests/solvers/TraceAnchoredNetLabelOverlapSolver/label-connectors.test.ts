import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceAnchoredNetLabelOverlapSolver } from "lib/solvers/TraceAnchoredNetLabelOverlapSolver/TraceAnchoredNetLabelOverlapSolver"
import { getLabelConnectorUpdates } from "lib/solvers/TraceAnchoredNetLabelOverlapSolver/getLabelConnectorUpdates"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = () => {
  const source = { pinId: "source", chipId: "source", x: -2, y: 0 }
  const target = { pinId: "target", chipId: "target", x: 2, y: 0 }
  const host: SolvedTracePath = {
    mspPairId: "host",
    dcConnNetId: "signal",
    globalConnNetId: "signal",
    pins: [source, target],
    pinIds: [source.pinId, target.pinId],
    mspConnectionPairIds: ["host"],
    tracePath: [source, target],
  }
  const connector: SolvedTracePath = {
    ...host,
    mspPairId: "connector",
    tracePath: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 },
      { x: 1, y: 1 },
    ],
  }
  const label: NetLabelPlacement = {
    netId: "signal",
    globalConnNetId: "signal",
    pinIds: host.pinIds,
    mspConnectionPairIds: ["host", "connector"],
    anchorPoint: { x: 1, y: 1 },
    center: { x: 1.25, y: 1 },
    width: 0.5,
    height: 0.2,
    orientation: "x+",
  }
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: { signal: ["x+"] },
  }
  return {
    inputProblem,
    traces: [host, connector],
    netLabelPlacements: [label],
    netLabelConnectorTraceIds: new Set([connector.mspPairId]),
    label,
    anchorPoint: { x: 0.5, y: 0.5 },
  }
}

for (const reversed of [false, true]) {
  test(`shortens a dedicated connector without mutating its input (reversed=${reversed})`, () => {
    const fixture = createFixture()
    if (reversed) fixture.traces[1]!.tracePath.reverse()
    const before = structuredClone(fixture)
    const path = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, fixture.anchorPoint]
    expect(getLabelConnectorUpdates(fixture)).toEqual([
      { traceId: "connector", tracePath: reversed ? path.reverse() : path },
    ])
    expect(fixture).toEqual(before)
  })
}

for (const attachment of ["pin", "label", "junction"] as const) {
  for (const retained of [false, true]) {
    test(`preserves a ${attachment} on the connector (retained=${retained})`, () => {
      const fixture = createFixture()
      const point = { x: 0.5, y: retained ? 0.25 : 0.75 }
      if (attachment === "pin") {
        fixture.inputProblem.chips.push({
          chipId: "attached",
          center: point,
          width: 0.1,
          height: 0.1,
          pins: [{ ...point, pinId: "attached" }],
        })
      } else if (attachment === "label") {
        fixture.netLabelPlacements.push({
          ...fixture.label,
          anchorPoint: point,
          center: { x: point.x + 0.25, y: point.y },
        })
      } else {
        fixture.traces.push({
          ...fixture.traces[0]!,
          mspPairId: "branch",
          // The junction lies inside both segments, not at a stored vertex.
          tracePath: [
            { x: 0.25, y: point.y },
            { x: 0.75, y: point.y },
          ],
        })
      }
      const updates = getLabelConnectorUpdates(fixture)
      if (retained) expect(updates).toHaveLength(1)
      else expect(updates).toBeNull()
      if (!retained) {
        expect(
          getLabelConnectorUpdates({ ...fixture, anchorPoint: { x: 0, y: 0 } }),
        ).toBeNull()
      }
    })
  }
}

test("does not shorten ordinary traces without connector provenance", () => {
  const fixture = createFixture()
  fixture.netLabelConnectorTraceIds.clear()
  expect(getLabelConnectorUpdates(fixture)).toEqual([])
})

test("rejects moving a connector terminal off its connected geometry", () => {
  const fixture = createFixture()
  expect(
    getLabelConnectorUpdates({ ...fixture, anchorPoint: { x: 3, y: 3 } }),
  ).toBeNull()
})

const addTraceObstacle = (fixture: ReturnType<typeof createFixture>) => {
  fixture.traces.push({
    ...fixture.traces[0]!,
    mspPairId: "obstacle",
    globalConnNetId: "other-net",
    tracePath: [
      { x: 1.2, y: 0.9 },
      { x: 1.2, y: 1.1 },
    ],
  })
}

for (const overlapMode of ["labels", "traces"] as const) {
  test(`moves the label and connector together for ${overlapMode} collisions`, () => {
    const fixture = createFixture()
    fixture.inputProblem.textBoxes = [
      { center: { x: 0.5, y: 0 }, width: 2, height: 0.4 },
    ]
    if (overlapMode === "traces") addTraceObstacle(fixture)
    else {
      fixture.netLabelPlacements.push({
        ...fixture.label,
        globalConnNetId: "other-net",
        mspConnectionPairIds: [],
        anchorPoint: { x: 1.5, y: 1 },
        orientation: "x-",
      })
    }
    const before = structuredClone(fixture)
    const solver = new TraceAnchoredNetLabelOverlapSolver({
      ...fixture,
      overlapMode,
    })
    solver.solve()
    const output = solver.getOutput()
    const label = output.netLabelPlacements[0]!
    const connector = output.traces.find(
      (trace) => trace.mspPairId === "connector",
    )!
    expect(label.anchorPoint).not.toEqual(fixture.label.anchorPoint)
    expect(connector.tracePath.at(-1)).toEqual(label.anchorPoint)
    expect(connector.tracePath[0]).toEqual(fixture.traces[1]!.tracePath[0])
    expect(connector.tracePath).toHaveLength(3)
    expect(output.traces[0]).toEqual(fixture.traces[0])
    expect(fixture).toEqual(before)
  })
}

test("removes a redundant connector when the label reaches the host", () => {
  const fixture = createFixture()
  fixture.inputProblem.availableNetLabelOrientations.signal = ["y+"]
  addTraceObstacle(fixture)
  const solver = new TraceAnchoredNetLabelOverlapSolver({
    ...fixture,
    overlapMode: "traces",
  })
  solver.solve()
  const output = solver.getOutput()
  expect(output.netLabelPlacements[0]!.anchorPoint).toEqual({ x: 0, y: 0 })
  expect(output.netLabelPlacements[0]!.mspConnectionPairIds).toEqual(["host"])
  expect(output.traces.map((trace) => trace.mspPairId)).toEqual([
    "host",
    "obstacle",
  ])
  expect(output.traces[0]).toEqual(fixture.traces[0])
})

test("leaves the connector and label unchanged when every candidate is blocked", () => {
  const fixture = createFixture()
  addTraceObstacle(fixture)
  fixture.inputProblem.textBoxes = [
    { center: { x: 0, y: 0 }, width: 10, height: 10 },
  ]
  const solver = new TraceAnchoredNetLabelOverlapSolver({
    ...fixture,
    overlapMode: "traces",
  })
  solver.solve()
  expect(solver.getOutput()).toEqual({
    traces: fixture.traces,
    netLabelPlacements: fixture.netLabelPlacements,
  })
})
