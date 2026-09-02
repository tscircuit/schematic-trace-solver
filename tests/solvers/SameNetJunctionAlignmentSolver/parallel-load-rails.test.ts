import { expect, test } from "bun:test"
import { alignSameNetJunctions } from "lib/solvers/SameNetJunctionAlignmentSolver/alignSameNetJunctions"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = (mirrorX = 1, mirrorY = 1) => {
  const point = (x: number, y: number) => ({ x: x * mirrorX, y: y * mirrorY })
  const facing = mirrorY === 1 ? "y-" : "y+"
  const pins: Array<SolvedTracePath["pins"][number]> = [
    { pinId: "A.1", chipId: "A", ...point(0, 1), _facingDirection: facing },
    { pinId: "B.1", chipId: "B", ...point(2, 1), _facingDirection: facing },
    { pinId: "C.1", chipId: "C", ...point(2, -1), _facingDirection: facing },
    {
      pinId: "U.1",
      chipId: "U",
      ...point(3, 0.6),
      _facingDirection: mirrorX === 1 ? "x-" : "x+",
    },
  ]
  const trace = (
    id: string,
    indexes: [number, number],
    coordinates: number[][],
  ): SolvedTracePath => ({
    mspPairId: id,
    dcConnNetId: "rail",
    globalConnNetId: "rail",
    userNetId: "RAIL",
    mspConnectionPairIds: [id],
    pins: [pins[indexes[0]]!, pins[indexes[1]]!],
    pinIds: indexes.map((index) => pins[index]!.pinId),
    tracePath: coordinates.map(([x, y]) => point(x!, y!)),
  })
  const traces = [
    trace(
      "parallel",
      [1, 0],
      [
        [2, 1],
        [2, 0.8],
        [0, 0.8],
        [0, 1],
      ],
    ),
    trace(
      "supply",
      [3, 1],
      [
        [3, 0.6],
        [2, 0.6],
        [2, 1],
      ],
    ),
    trace(
      "return",
      [2, 1],
      [
        [2, -1],
        [2, -1.2],
        [1.2, -1.2],
        [1.2, 0.8],
        [2, 0.8],
        [2, 1],
      ],
    ),
  ]
  const inputProblem: InputProblem = {
    chips: pins.map((pin, index) => ({
      chipId: pin.chipId,
      center:
        index === 3 ? point(3.2, 0.6) : { x: pin.x, y: pin.y + 0.2 * mirrorY },
      width: 0.4,
      height: 0.4,
      pins: [pin],
    })),
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  return {
    inputProblem,
    traces,
    point,
    netLabelPlacements: [] as NetLabelPlacement[],
    netLabelConnectorTraceIds: new Set<string>(),
  }
}

for (const mirrorX of [1, -1]) {
  for (const mirrorY of [1, -1]) {
    test(`levels parallel rails and aligns return columns (${mirrorX}, ${mirrorY})`, () => {
      const fixture = createFixture(mirrorX, mirrorY)
      const before = structuredClone(fixture.traces)
      const result = alignSameNetJunctions(fixture)
      expect(result.alignedJunctionCount).toBe(2)
      const parallel = result.traces.find(
        (trace) => trace.mspPairId === "parallel",
      )!
      expect(parallel.tracePath).toEqual([
        fixture.point(2, 1),
        fixture.point(2, 0.6),
        fixture.point(0, 0.6),
        fixture.point(0, 1),
      ])
      const branch = result.traces.find(
        (trace) => trace.mspPairId === "return",
      )!
      expect(branch.tracePath).toEqual([
        fixture.point(2, -1),
        fixture.point(2, -1.2),
        fixture.point(0, -1.2),
        fixture.point(0, 0.6),
        fixture.point(2, 0.6),
        fixture.point(2, 1),
      ])
      for (const trace of result.traces) {
        expect(trace.tracePath[0]).toEqual({
          x: trace.pins[0]!.x,
          y: trace.pins[0]!.y,
        })
        expect(trace.tracePath.at(-1)).toEqual({
          x: trace.pins[1]!.x,
          y: trace.pins[1]!.y,
        })
      }
      expect(fixture.traces).toEqual(before)
      expect(
        alignSameNetJunctions({ ...fixture, traces: result.traces }).traces,
      ).toEqual(result.traces)
    })
  }
}

test("reversing trace order and endpoints preserves the aligned geometry", () => {
  const fixture = createFixture()
  fixture.traces.reverse()
  for (const trace of fixture.traces) {
    trace.pins.reverse()
    trace.pinIds.reverse()
    trace.tracePath.reverse()
  }
  const result = alignSameNetJunctions(fixture)
  expect(result.alignedJunctionCount).toBe(2)
  const branch = result.traces.find((trace) => trace.mspPairId === "return")!
  expect(
    branch.tracePath.every((point) => point.x === 0 || point.x === 2),
  ).toBe(true)
})

test("does not route a return column through a component", () => {
  const fixture = createFixture()
  fixture.inputProblem.chips.push({
    chipId: "obstacle",
    center: { x: 0, y: 0 },
    width: 0.2,
    height: 0.2,
    pins: [],
  })
  const original = structuredClone(fixture.traces[2]!)
  const result = alignSameNetJunctions(fixture)
  expect(result.traces.find((trace) => trace.mspPairId === "return")).toEqual(
    original,
  )
})

for (const [name, path] of [
  [
    "perpendicular",
    [
      { x: -0.5, y: 0 },
      { x: 0.5, y: 0 },
    ],
  ],
  [
    "collinear",
    [
      { x: 0, y: -0.5 },
      { x: 0, y: 0.3 },
    ],
  ],
] as const) {
  test(`does not introduce a ${name} cross-net intersection`, () => {
    const fixture = createFixture()
    const original = structuredClone(fixture.traces[2]!)
    fixture.traces.push({
      ...original,
      mspPairId: "foreign",
      globalConnNetId: "foreign",
      tracePath: [...path],
    })
    const result = alignSameNetJunctions(fixture)
    expect(result.traces.find((trace) => trace.mspPairId === "return")).toEqual(
      original,
    )
  })
}

test("shortens the return escape when the original length would cross another net", () => {
  const fixture = createFixture()
  fixture.traces.push({
    ...fixture.traces[2]!,
    mspPairId: "foreign",
    globalConnNetId: "foreign",
    tracePath: [
      { x: -0.5, y: -1.1 },
      { x: 1, y: -1.1 },
      { x: 1, y: -1.3 },
    ],
  })
  const result = alignSameNetJunctions(fixture)
  const branch = result.traces.find((trace) => trace.mspPairId === "return")!
  expect(
    branch.tracePath.every((point) => point.x === 0 || point.x === 2),
  ).toBe(true)
  expect(Math.min(...branch.tracePath.map((point) => point.y))).toBeCloseTo(
    -1.05,
    6,
  )
})

test("keeps a label attached when the return branch moves", () => {
  const fixture = createFixture()
  fixture.netLabelPlacements.push({
    globalConnNetId: "rail",
    dcConnNetId: "rail",
    netId: "RAIL",
    mspConnectionPairIds: ["return"],
    pinIds: ["C.1", "B.1"],
    anchorPoint: { x: 1.2, y: 0 },
    center: { x: 1.1, y: 0 },
    width: 0.2,
    height: 0.1,
    orientation: "x-",
  })
  const result = alignSameNetJunctions(fixture)
  const branch = result.traces.find((trace) => trace.mspPairId === "return")!
  expect(
    branch.tracePath.every((point) => point.x === 0 || point.x === 2),
  ).toBe(true)
  expect(
    tracePathContainsPoint(
      branch.tracePath,
      result.netLabelPlacements[0]!.anchorPoint,
    ),
  ).toBe(true)
})

test("does not combine rails belonging to different nets", () => {
  const fixture = createFixture()
  fixture.traces[2]!.globalConnNetId = "different"
  const original = structuredClone(fixture.traces[2]!)
  const result = alignSameNetJunctions(fixture)
  expect(result.traces.find((trace) => trace.mspPairId === "return")).toEqual(
    original,
  )
})

test("does not force an outer return column onto staggered load pins", () => {
  const fixture = createFixture()
  fixture.traces[0]!.pins[1].y = 1.4
  fixture.traces[0]!.tracePath.at(-1)!.y = 1.4
  const original = structuredClone(fixture.traces[2]!)
  const result = alignSameNetJunctions(fixture)
  expect(result.traces.find((trace) => trace.mspPairId === "return")).toEqual(
    original,
  )
})

for (const net of ["rail", "foreign"]) {
  test(`does not enter a ${net} label while extending the return column`, () => {
    const fixture = createFixture()
    fixture.netLabelPlacements.push({
      globalConnNetId: net,
      dcConnNetId: net,
      netId: net,
      mspConnectionPairIds: [],
      pinIds: [],
      orientation: "x+",
      anchorPoint: { x: -0.1, y: 0 },
      center: { x: 0, y: 0 },
      width: 0.2,
      height: 0.2,
    })
    const original = structuredClone(fixture.traces[2]!)
    const result = alignSameNetJunctions(fixture)
    expect(result.traces.find((trace) => trace.mspPairId === "return")).toEqual(
      original,
    )
  })
}
