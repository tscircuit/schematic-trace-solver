import { expect, test } from "bun:test"
import { alignSameNetJunctions } from "lib/solvers/SameNetJunctionAlignmentSolver/alignSameNetJunctions"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = (quarterTurns: number, reverse: boolean) => {
  const point = (x: number, y: number) => {
    switch (quarterTurns % 4) {
      case 1:
        return { x: -y, y: x }
      case 2:
        return { x: -x, y: -y }
      case 3:
        return { x: y, y: -x }
      default:
        return { x, y }
    }
  }
  const hostPins: SolvedTracePath["pins"] = [
    { pinId: "host.start", chipId: "start", ...point(0, 1) },
    { pinId: "host.end", chipId: "end", ...point(1, 0) },
  ]
  const trace = (
    mspPairId: string,
    tracePath: Array<[number, number]>,
  ): SolvedTracePath => ({
    mspPairId,
    dcConnNetId: "signal",
    globalConnNetId: "signal",
    userNetId: "SIGNAL",
    pins: structuredClone(hostPins),
    pinIds: hostPins.map((pin) => pin.pinId),
    mspConnectionPairIds: [mspPairId],
    tracePath: tracePath.map(([x, y]) => point(x, y)),
  })
  const hostTrace = trace("host", [
    [0, 1],
    [0.4, 1],
    [0.4, 0],
    [1, 0],
  ])
  const connectorTrace = trace("available-net-orientation-0-SIGNAL", [
    [0.7, 0],
    [0.6, 0],
    [0.6, -1],
    [-1, -1],
  ])
  const expectedConnectorPath = [
    point(0.7, 0),
    point(0.4, 0),
    point(0.4, -1),
    point(-1, -1),
  ]
  const traces = [hostTrace, connectorTrace]
  if (reverse) {
    traces.reverse()
    for (const item of traces) {
      item.pins.reverse()
      item.pinIds.reverse()
      item.tracePath.reverse()
    }
    expectedConnectorPath.reverse()
  }

  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "start",
        center: point(0, 1.1),
        width: 0.1,
        height: 0.1,
        pins: [hostPins[0]!],
      },
      {
        chipId: "end",
        center: point(1.1, 0),
        width: 0.1,
        height: 0.1,
        pins: [hostPins[1]!],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const label: NetLabelPlacement = {
    globalConnNetId: "signal",
    dcConnNetId: "signal",
    netId: "SIGNAL",
    mspConnectionPairIds: ["host"],
    pinIds: hostPins.map((pin) => pin.pinId),
    orientation: "x-",
    anchorPoint: point(-1, -1),
    center: point(-1.1, -1),
    width: 0.2,
    height: 0.2,
  }

  return {
    inputProblem,
    traces,
    netLabelPlacements: [label],
    expectedConnectorPath,
    point,
  }
}

for (const quarterTurns of [0, 1, 2, 3]) {
  for (const reverse of [false, true]) {
    test(`aligns an attached label connector rail (turns=${quarterTurns}, reverse=${reverse})`, () => {
      const fixture = createFixture(quarterTurns, reverse)
      const originalHost = structuredClone(
        fixture.traces.find((trace) => trace.mspPairId === "host")!,
      )
      const result = alignSameNetJunctions(fixture)

      expect(result.alignedJunctionCount).toBe(1)
      expect(result.traces.find((trace) => trace.mspPairId === "host")).toEqual(
        originalHost,
      )
      expect(
        result.traces.find(
          (trace) => trace.mspPairId === "available-net-orientation-0-SIGNAL",
        )!.tracePath,
      ).toEqual(fixture.expectedConnectorPath)
      expect(result.netLabelPlacements[0]!.anchorPoint).toEqual(
        fixture.point(-1, -1),
      )
    })
  }
}

test("keeps a label connector jog when the aligned rail hits a component", () => {
  const fixture = createFixture(0, false)
  const originalConnector = structuredClone(
    fixture.traces.find((trace) =>
      trace.mspPairId.startsWith("available-net-orientation-"),
    )!,
  )
  fixture.inputProblem.chips.push({
    chipId: "obstacle",
    center: { x: 0.4, y: -0.5 },
    width: 0.1,
    height: 0.1,
    pins: [],
  })

  const result = alignSameNetJunctions(fixture)
  expect(
    result.traces.find(
      (trace) => trace.mspPairId === originalConnector.mspPairId,
    ),
  ).toEqual(originalConnector)
})

test("keeps a connector that already starts at the donor corner", () => {
  const fixture = createFixture(0, false)
  const connector = fixture.traces.find((trace) =>
    trace.mspPairId.startsWith("available-net-orientation-"),
  )!
  connector.tracePath = [
    { x: 0.4, y: 0 },
    { x: 0.6, y: 0 },
    { x: 0.6, y: -1 },
    { x: -1, y: -1 },
  ]
  const originalConnector = structuredClone(connector)

  const result = alignSameNetJunctions(fixture)
  expect(
    result.traces.find((trace) => trace.mspPairId === connector.mspPairId),
  ).toEqual(originalConnector)
})

test("keeps a connector whose aligned rail would overlap the donor rail", () => {
  const fixture = createFixture(0, false)
  const connector = fixture.traces.find((trace) =>
    trace.mspPairId.startsWith("available-net-orientation-"),
  )!
  connector.tracePath = [
    { x: 0.7, y: 0 },
    { x: 0.6, y: 0 },
    { x: 0.6, y: 0.5 },
    { x: -1, y: 0.5 },
  ]
  const originalConnector = structuredClone(connector)

  const result = alignSameNetJunctions(fixture)
  expect(
    result.traces.find((trace) => trace.mspPairId === connector.mspPairId),
  ).toEqual(originalConnector)
})
