import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceAnchoredNetLabelOverlapSolver } from "lib/solvers/TraceAnchoredNetLabelOverlapSolver/TraceAnchoredNetLabelOverlapSolver"
import {
  getLabelBounds,
  getTraceLocationsForPoint,
  traceIntersectsBounds,
} from "lib/solvers/TraceAnchoredNetLabelOverlapSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"

const createFixture = () => {
  const source = { pinId: "source", chipId: "connector", x: 0, y: 0 }
  const target = { pinId: "target", chipId: "resistor", x: 2, y: 2 }
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "connector",
        center: { x: -1, y: 0 },
        width: 2,
        height: 1,
        pins: [source],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const host: SolvedTracePath = {
    mspPairId: "host",
    dcConnNetId: "signal",
    globalConnNetId: "signal",
    pins: [source, target],
    pinIds: ["source", "target"],
    mspConnectionPairIds: ["host"],
    tracePath: [source, { x: 0.2, y: 0 }, { x: 0.2, y: 2 }, target],
  }
  const traces = [
    host,
    ...[0.2, 0.4].map(
      (y, index): SolvedTracePath => ({
        mspPairId: `neighbor-${index}`,
        dcConnNetId: `neighbor-${index}`,
        globalConnNetId: `neighbor-${index}`,
        pins: [source, source],
        pinIds: ["neighbor"],
        mspConnectionPairIds: [],
        tracePath: [
          { x: 0, y },
          { x: 1, y },
        ],
      }),
    ),
  ]
  const labels: NetLabelPlacement[] = [
    {
      netId: "signal",
      globalConnNetId: "signal",
      pinIds: host.pinIds,
      mspConnectionPairIds: ["host"],
      anchorPoint: { x: 0.2, y: 0.3 },
      center: { x: 0.425, y: 0.3 },
      width: 0.45,
      height: 0.2,
      orientation: "x+",
    },
    {
      netId: "fixed",
      globalConnNetId: "fixed",
      pinIds: ["fixed"],
      mspConnectionPairIds: [],
      anchorPoint: { x: 1, y: -0.3 },
      center: { x: 0.5, y: -0.3 },
      width: 1,
      height: 0.8,
      orientation: "x-",
    },
  ]
  return {
    inputProblem,
    traces,
    netLabelPlacements: labels,
    overlapMode: "traces" as const,
  }
}

for (const turns of [0, 1, 2, 3]) {
  for (const reversed of [false, true]) {
    test(`moves a label off different-net trace edges (${turns * 90} degrees, reversed=${reversed})`, () => {
      const fixture = createFixture()
      const rotate = ({ x, y }: { x: number; y: number }) =>
        [
          { x, y },
          { x: -y, y: x },
          { x: -x, y: -y },
          { x: y, y: -x },
        ][turns]!
      const orientations: FacingDirection[] = ["x+", "y+", "x-", "y-"]
      for (const chip of fixture.inputProblem.chips) {
        chip.center = rotate(chip.center)
        chip.pins = chip.pins.map((pin) => ({ ...pin, ...rotate(pin) }))
        if (turns % 2) [chip.width, chip.height] = [chip.height, chip.width]
      }
      for (const trace of fixture.traces) {
        trace.pins = trace.pins.map((pin) => ({
          ...pin,
          ...rotate(pin),
        })) as typeof trace.pins
        trace.tracePath = trace.tracePath.map(rotate)
        if (reversed) trace.tracePath.reverse()
      }
      for (const label of fixture.netLabelPlacements) {
        label.anchorPoint = rotate(label.anchorPoint)
        label.center = rotate(label.center)
        label.orientation =
          orientations[(orientations.indexOf(label.orientation) + turns) % 4]!
        if (turns % 2) [label.width, label.height] = [label.height, label.width]
      }
      const before = structuredClone(fixture)
      const solver = new TraceAnchoredNetLabelOverlapSolver(fixture)
      solver.solve()
      const label = solver.getOutput().netLabelPlacements[0]!
      expect(label.anchorPoint).not.toEqual(
        before.netLabelPlacements[0]!.anchorPoint,
      )
      expect(
        getTraceLocationsForPoint(label.anchorPoint, [fixture.traces[0]!])
          .length,
      ).toBeGreaterThan(0)
      for (const trace of fixture.traces.slice(1)) {
        expect(traceIntersectsBounds(getLabelBounds(label), trace)).toBe(false)
      }
      expect(solver.getOutput().netLabelPlacements[1]).toEqual(
        before.netLabelPlacements[1],
      )
      expect(fixture).toEqual(before)
    })
  }
}

test("moves a label when another net crosses its interior", () => {
  const fixture = createFixture()
  fixture.traces = [
    fixture.traces[0]!,
    {
      ...fixture.traces[1]!,
      tracePath: [
        { x: 0, y: 0.3 },
        { x: 1, y: 0.3 },
      ],
    },
  ]
  const solver = new TraceAnchoredNetLabelOverlapSolver(fixture)
  solver.solve()
  const label = solver.getOutput().netLabelPlacements[0]!
  expect(traceIntersectsBounds(getLabelBounds(label), fixture.traces[1]!)).toBe(
    false,
  )
})

test("allows point contact with another net at the label boundary", () => {
  const fixture = createFixture()
  fixture.traces = [
    fixture.traces[0]!,
    {
      ...fixture.traces[1]!,
      tracePath: [
        { x: 0.65, y: 0.3 },
        { x: 1, y: 0.3 },
      ],
    },
  ]
  const solver = new TraceAnchoredNetLabelOverlapSolver(fixture)
  solver.solve()
  expect(solver.getOutput().netLabelPlacements).toEqual(
    fixture.netLabelPlacements,
  )
})

test("does not move labels for a same-net boundary attachment", () => {
  const fixture = createFixture()
  for (const trace of fixture.traces) trace.globalConnNetId = "signal"
  const solver = new TraceAnchoredNetLabelOverlapSolver(fixture)
  solver.solve()
  expect(solver.getOutput().netLabelPlacements).toEqual(
    fixture.netLabelPlacements,
  )
})

test("leaves the label attached when every alternative is blocked", () => {
  const fixture = createFixture()
  fixture.inputProblem.textBoxes = [
    { center: { x: 0, y: 0 }, width: 10, height: 10 },
  ]
  const solver = new TraceAnchoredNetLabelOverlapSolver(fixture)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.getOutput().netLabelPlacements).toEqual(
    fixture.netLabelPlacements,
  )
})

test("respects required orientations while moving along the host", () => {
  const fixture = createFixture()
  fixture.inputProblem.availableNetLabelOrientations.signal = ["y+"]
  const solver = new TraceAnchoredNetLabelOverlapSolver(fixture)
  solver.solve()
  const label = solver.getOutput().netLabelPlacements[0]!
  expect(label.orientation).toBe("y+")
  expect(
    getTraceLocationsForPoint(label.anchorPoint, [fixture.traces[0]!]).length,
  ).toBeGreaterThan(0)
})

test("preserves the default label-overlap mode", () => {
  const fixture = createFixture()
  const { overlapMode, ...params } = fixture
  const solver = new TraceAnchoredNetLabelOverlapSolver(params)
  solver.solve()
  expect(solver.getOutput().netLabelPlacements).toEqual(
    fixture.netLabelPlacements,
  )
})

test("does not detach a terminal label from its one-pin connector", () => {
  const fixture = createFixture()
  fixture.traces[0]!.pinIds = ["source"]
  const solver = new TraceAnchoredNetLabelOverlapSolver(fixture)
  solver.solve()
  expect(solver.getOutput().netLabelPlacements).toEqual(
    fixture.netLabelPlacements,
  )
})
