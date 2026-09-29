import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceAnchoredNetLabelOverlapSolver } from "lib/solvers/TraceAnchoredNetLabelOverlapSolver/TraceAnchoredNetLabelOverlapSolver"
import { getTraceLocationsForPoint } from "lib/solvers/TraceAnchoredNetLabelOverlapSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = () => {
  const source = { pinId: "source", chipId: "source", x: 0, y: 0 }
  const target = { pinId: "target", chipId: "target", x: 3, y: 0 }
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
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  }
  const label: NetLabelPlacement = {
    netId: "signal",
    globalConnNetId: "signal",
    pinIds: host.pinIds,
    mspConnectionPairIds: ["host"],
    anchorPoint: { x: 2, y: 1 },
    center: { x: 2.25, y: 1 },
    width: 0.5,
    height: 0.2,
    orientation: "x+",
  }
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  return {
    inputProblem,
    traces: [
      host,
      connector,
      {
        ...host,
        mspPairId: "obstacle",
        globalConnNetId: "other-net",
        tracePath: [
          { x: 2.25, y: 0.9 },
          { x: 2.25, y: 1.1 },
        ],
      },
    ],
    netLabelPlacements: [label],
    netLabelConnectorTraceIds: new Set([connector.mspPairId]),
  }
}

for (const overlapMode of ["labels", "traces"] as const) {
  for (const reversed of [false, true]) {
    test(`does not use generated connectors with inherited pin IDs as hosts (${overlapMode}, reversed=${reversed})`, () => {
      const fixture = createFixture()
      if (reversed) fixture.traces[1]!.tracePath.reverse()
      if (overlapMode === "labels") {
        fixture.netLabelPlacements.push({
          ...fixture.netLabelPlacements[0]!,
          globalConnNetId: "fixed",
          mspConnectionPairIds: [],
          anchorPoint: { x: 2.5, y: 1 },
          orientation: "x-",
        })
      }
      const before = structuredClone(fixture)
      const solver = new TraceAnchoredNetLabelOverlapSolver({
        ...fixture,
        overlapMode,
      })
      solver.solve()
      expect(solver.getOutput().netLabelPlacements).toEqual(
        before.netLabelPlacements,
      )
      expect(solver.traces).toEqual(before.traces)
      expect(fixture).toEqual(before)
    })
  }
}

test("allows ordinary host traces with the same geometry and pin IDs", () => {
  const fixture = createFixture()
  fixture.netLabelConnectorTraceIds.clear()
  const solver = new TraceAnchoredNetLabelOverlapSolver({
    ...fixture,
    overlapMode: "traces",
  })
  solver.solve()
  expect(solver.getOutput().netLabelPlacements[0]!.anchorPoint).not.toEqual(
    fixture.netLabelPlacements[0]!.anchorPoint,
  )
  expect(solver.traces).toEqual(fixture.traces)
})

test("searches only the actual host when an anchor also touches a generated connector", () => {
  const fixture = createFixture()
  const [host, connector, obstacle] = fixture.traces
  host!.tracePath = [
    { x: 0, y: 1 },
    { x: 3, y: 1 },
  ]
  fixture.traces = [connector!, host!, obstacle!]
  const solver = new TraceAnchoredNetLabelOverlapSolver({
    ...fixture,
    overlapMode: "traces",
  })
  solver.solve()
  const label = solver.getOutput().netLabelPlacements[0]!
  expect(label.anchorPoint).not.toEqual(
    fixture.netLabelPlacements[0]!.anchorPoint,
  )
  expect(
    getTraceLocationsForPoint(label.anchorPoint, [host!]).length,
  ).toBeGreaterThan(0)
  expect(solver.traces).toEqual(fixture.traces)
})
