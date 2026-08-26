import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { placeGroundRailLabelsAtOuterEnd } from "lib/solvers/SameNetJunctionAlignmentSolver/placeGroundRailLabelsAtOuterEnd"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { createParallelGroundRailProblem } from "tests/fixtures/parallel-ground-rail"

const createFixture = () => {
  const inputProblem = createParallelGroundRailProblem()
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const globalConnNetId = netConnMap.getNetConnectedToId("GND")!
  const pins = new Map(
    inputProblem.chips.flatMap((chip) =>
      chip.pins.map(
        (pin) => [pin.pinId, { ...pin, chipId: chip.chipId }] as const,
      ),
    ),
  )
  const trace = (
    mspPairId: string,
    pinIds: [string, string],
    path: number[][],
  ): SolvedTracePath => ({
    mspPairId,
    mspConnectionPairIds: [mspPairId],
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    userNetId: "GND",
    pinIds,
    pins: [pins.get(pinIds[0])!, pins.get(pinIds[1])!],
    tracePath: path.map(([x, y]) => ({ x: x!, y: y! })),
  })
  const traces = [
    trace(
      "rail",
      ["B.2", "A.2"],
      [
        [1, 1],
        [1, 0.6],
        [0, 0.6],
        [0, 1],
      ],
    ),
    trace(
      "feed",
      ["U.GND", "B.2"],
      [
        [2, 0.6],
        [1, 0.6],
        [1, 1],
      ],
    ),
  ]
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId,
      dcConnNetId: globalConnNetId,
      netId: "GND",
      mspConnectionPairIds: ["feed"],
      pinIds: ["U.GND", "B.2"],
      orientation: "y-",
      anchorPoint: { x: 1, y: 0.6 },
      center: { x: 1, y: 0.4 },
      width: 0.4,
      height: 0.4,
    },
  ]
  return { inputProblem, traces, netLabelPlacements }
}

for (const mirror of [1, -1]) {
  test(`places the shared GND at the outer column, mirrored=${mirror}`, () => {
    const fixture = createFixture()
    for (const chip of fixture.inputProblem.chips) {
      chip.center.x *= mirror
      for (const pin of chip.pins) pin.x *= mirror
    }
    for (const trace of fixture.traces) {
      for (const point of trace.tracePath) point.x *= mirror
    }
    const visited = new Set()
    for (const pin of fixture.traces.flatMap((trace) => trace.pins)) {
      if (visited.has(pin)) continue
      pin.x *= mirror
      visited.add(pin)
    }
    fixture.netLabelPlacements[0]!.anchorPoint.x *= mirror
    fixture.netLabelPlacements[0]!.center.x *= mirror
    const before = structuredClone(fixture)
    const labels = placeGroundRailLabelsAtOuterEnd(fixture)
    expect(labels[0]!.anchorPoint.x).toBeCloseTo(0, 6)
    expect(labels[0]!.anchorPoint.y).toBeCloseTo(0.6, 6)
    expect(labels[0]!.mspConnectionPairIds).toEqual(["rail"])
    expect(labels[0]!.globalConnNetId).toBe(
      before.netLabelPlacements[0]!.globalConnNetId,
    )
    expect(fixture).toEqual(before)
    expect(
      placeGroundRailLabelsAtOuterEnd({
        ...fixture,
        netLabelPlacements: labels,
      }),
    ).toEqual(labels)
  })
}

test("label placement is independent of trace and endpoint ordering", () => {
  const fixture = createFixture()
  fixture.traces.reverse()
  for (const trace of fixture.traces) {
    trace.tracePath.reverse()
    trace.pins.reverse()
    trace.pinIds.reverse()
  }
  expect(placeGroundRailLabelsAtOuterEnd(fixture)[0]!.anchorPoint).toEqual({
    x: 0,
    y: 0.6,
  })
})

for (const obstacle of [
  "chip",
  "text",
  "trace",
  "same-net-trace",
  "label",
  "same-net-label",
] as const) {
  test(`keeps the existing anchor when the outer label would hit a ${obstacle}`, () => {
    const fixture = createFixture()
    const rect = { center: { x: 0, y: 0.4 }, width: 0.2, height: 0.2 }
    if (obstacle === "chip")
      fixture.inputProblem.chips.push({ ...rect, chipId: "obstacle", pins: [] })
    if (obstacle === "text")
      fixture.inputProblem.textBoxes = [{ ...rect, text: "annotation" }]
    if (obstacle === "trace" || obstacle === "same-net-trace")
      fixture.traces.push({
        ...fixture.traces[0]!,
        mspPairId: "obstacle",
        globalConnNetId:
          obstacle === "trace" ? "foreign" : fixture.traces[0]!.globalConnNetId,
        tracePath: [
          { x: -0.4, y: 0.4 },
          { x: 0.4, y: 0.4 },
        ],
      })
    if (obstacle === "label" || obstacle === "same-net-label")
      fixture.netLabelPlacements.push({
        ...fixture.netLabelPlacements[0]!,
        ...rect,
        globalConnNetId:
          obstacle === "label"
            ? "foreign"
            : fixture.netLabelPlacements[0]!.globalConnNetId,
        mspConnectionPairIds: [],
        pinIds: [],
        anchorPoint: { x: 0, y: 0.5 },
      })
    expect(placeGroundRailLabelsAtOuterEnd(fixture)).toEqual(
      fixture.netLabelPlacements,
    )
  })
}

test("does not move a port-only or unrelated island's GND label", () => {
  const fixture = createFixture()
  fixture.netLabelPlacements[0]!.mspConnectionPairIds = []
  expect(placeGroundRailLabelsAtOuterEnd(fixture)).toEqual(
    fixture.netLabelPlacements,
  )
  fixture.netLabelPlacements[0]!.mspConnectionPairIds = ["another-island"]
  expect(placeGroundRailLabelsAtOuterEnd(fixture)).toEqual(
    fixture.netLabelPlacements,
  )
})

test("does not force staggered ground pins or power labels to an outer column", () => {
  const fixture = createFixture()
  fixture.traces[0]!.pins[0].y += 0.2
  expect(placeGroundRailLabelsAtOuterEnd(fixture)).toEqual(
    fixture.netLabelPlacements,
  )
  fixture.traces[0]!.pins[0].y -= 0.2
  fixture.netLabelPlacements[0]!.orientation = "y+"
  expect(placeGroundRailLabelsAtOuterEnd(fixture)).toEqual(
    fixture.netLabelPlacements,
  )
})
