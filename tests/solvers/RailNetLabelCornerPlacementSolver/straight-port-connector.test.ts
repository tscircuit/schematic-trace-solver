import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const createFixture = (mirror = 1, direction = 1, reversed = false) => {
  const point = (x: number, y: number) => ({ x: x * mirror, y: y * direction })
  const pin = { pinId: "U.1", chipId: "U", ...point(0, 0) }
  const orientation = direction === 1 ? ("y-" as const) : ("y+" as const)
  const inputProblem: InputProblem = {
    chips: [
      { chipId: "U", center: point(1, 0), width: 2, height: 2, pins: [pin] },
    ],
    directConnections: [],
    netConnections: [{ netId: "rail", pinIds: [pin.pinId] }],
    availableNetLabelOrientations: { rail: [orientation] },
  }
  const trace: SolvedTracePath = {
    mspPairId: "connector",
    mspConnectionPairIds: ["connector"],
    globalConnNetId: "rail",
    dcConnNetId: "rail",
    pins: [pin, pin],
    pinIds: [pin.pinId],
    tracePath: [
      point(0, 0),
      point(-0.2, 0),
      point(-0.2, -0.1),
      point(-2, -0.1),
      point(-2, -0.05),
    ],
  }
  if (reversed) trace.tracePath.reverse()
  const label: NetLabelPlacement = {
    globalConnNetId: "rail",
    netId: "rail",
    mspConnectionPairIds: [],
    pinIds: [pin.pinId],
    orientation,
    anchorPoint: point(-2, -0.05),
    center: point(-2, -0.25),
    width: 0.4,
    height: 0.4,
  }
  const initialTrace = {
    ...trace,
    tracePath: [point(0, 0), point(-2, 0), label.anchorPoint],
  }
  if (reversed) initialTrace.tracePath.reverse()
  return {
    inputProblem,
    traces: [trace],
    originalTraces: [trace],
    netLabelPlacements: [label],
    netLabelConnectorTraceIds: new Set([trace.mspPairId]),
    completedTraceShifts: [
      {
        initialTrace,
        shiftedTracePath: structuredClone(trace.tracePath),
      },
    ],
    onlyOverlappingLabels: true,
  }
}

for (const mirror of [1, -1]) {
  for (const direction of [1, -1]) {
    for (const reversed of [false, true]) {
      test(`straightens a terminal rail connector, mirror=${mirror}, direction=${direction}, reversed=${reversed}`, () => {
        const fixture = createFixture(mirror, direction, reversed)
        const before = structuredClone(fixture)
        const solver = new RailNetLabelCornerPlacementSolver(fixture)
        solver.solve()
        const output = solver.getOutput()
        expect(output.traces[0]!.tracePath).toEqual([
          { x: 0 * mirror, y: 0 * direction },
          { x: -2 * mirror, y: 0 * direction },
        ])
        expect(output.netLabelPlacements[0]!.anchorPoint).toEqual(
          output.traces[0]!.tracePath[1]!,
        )
        expect(output.netLabelPlacements[0]!.orientation).toBe(
          before.netLabelPlacements[0]!.orientation,
        )
        expect(output.netLabelPlacements[0]!.center).toEqual({
          x: -2 * mirror,
          y: -0.2 * direction,
        })
        expect(fixture).toEqual(before)

        const secondPass = new RailNetLabelCornerPlacementSolver({
          ...fixture,
          ...output,
        })
        secondPass.solve()
        expect(secondPass.getOutput()).toEqual(output)
      })
    }
  }
}

test("reconsiders a connector after its overlapping obstacle is simplified", () => {
  const fixture = createFixture()
  const obstacle: SolvedTracePath = {
    ...fixture.traces[0]!,
    mspPairId: "signal",
    globalConnNetId: "signal",
    tracePath: [
      { x: 0, y: 0.2 },
      { x: -0.9, y: 0.2 },
      { x: -0.9, y: 0 },
      { x: -1.5, y: 0 },
      { x: -1.5, y: -2 },
    ],
  }
  fixture.traces.push(obstacle)
  const blocked = new RailNetLabelCornerPlacementSolver(fixture)
  blocked.solve()
  expect(blocked.getOutput().traces[0]).toEqual(fixture.traces[0])

  const clear = new RailNetLabelCornerPlacementSolver({
    ...fixture,
    originalTraces: fixture.traces,
    traces: [
      fixture.traces[0]!,
      {
        ...obstacle,
        tracePath: [
          { x: 0, y: 0.2 },
          { x: -1.5, y: 0.2 },
          { x: -1.5, y: -2 },
        ],
      },
    ],
  })
  clear.solve()
  expect(clear.getOutput().traces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: -2, y: 0 },
  ])
})

test("requires generated connector provenance", () => {
  const fixture = createFixture()
  fixture.netLabelConnectorTraceIds.clear()
  const solver = new RailNetLabelCornerPlacementSolver(fixture)
  solver.solve()
  expect(solver.getOutput()).toEqual({
    traces: fixture.traces,
    netLabelPlacements: fixture.netLabelPlacements,
  })
})

test("preserves an unshifted single elbow used to reach a rail label", () => {
  const fixture = createFixture()
  fixture.traces[0]!.tracePath = [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    fixture.netLabelPlacements[0]!.anchorPoint,
  ]
  fixture.completedTraceShifts = []
  const solver = new RailNetLabelCornerPlacementSolver(fixture)
  solver.solve()
  expect(solver.getOutput()).toEqual({
    traces: fixture.traces,
    netLabelPlacements: fixture.netLabelPlacements,
  })
})

test("does not simplify an unrecorded detour", () => {
  const fixture = createFixture()
  const solver = new RailNetLabelCornerPlacementSolver({
    ...fixture,
    completedTraceShifts: undefined,
  })
  solver.solve()
  expect(solver.getOutput()).toEqual({
    traces: fixture.traces,
    netLabelPlacements: fixture.netLabelPlacements,
  })
})

test("straightens a recorded shift with only one remaining bend", () => {
  const fixture = createFixture()
  fixture.traces[0]!.tracePath = [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    fixture.netLabelPlacements[0]!.anchorPoint,
  ]
  fixture.completedTraceShifts = [
    {
      initialTrace: {
        ...fixture.traces[0]!,
        tracePath: [
          { x: 0, y: 0 },
          { x: -1.9, y: 0 },
          { x: -1.9, y: -0.05 },
          fixture.netLabelPlacements[0]!.anchorPoint,
        ],
      },
      shiftedTracePath: structuredClone(fixture.traces[0]!.tracePath),
    },
  ]
  const solver = new RailNetLabelCornerPlacementSolver(fixture)
  solver.solve()
  expect(solver.getOutput().traces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: -2, y: 0 },
  ])
})

test("does not undo geometry changed after the recorded overlap shift", () => {
  const fixture = createFixture()
  fixture.traces[0]!.tracePath[2]!.y = -0.15
  fixture.traces[0]!.tracePath[3]!.y = -0.15
  const solver = new RailNetLabelCornerPlacementSolver(fixture)
  solver.solve()
  expect(solver.getOutput()).toEqual({
    traces: fixture.traces,
    netLabelPlacements: fixture.netLabelPlacements,
  })
})

test("does not treat an unchanged route as an overlap shift", () => {
  const fixture = createFixture()
  fixture.completedTraceShifts[0]!.initialTrace = structuredClone(
    fixture.traces[0]!,
  )
  const solver = new RailNetLabelCornerPlacementSolver(fixture)
  solver.solve()
  expect(solver.getOutput()).toEqual({
    traces: fixture.traces,
    netLabelPlacements: fixture.netLabelPlacements,
  })
})

test("does not mutate an already straight shifted connector in reverse order", () => {
  const fixture = createFixture()
  const anchorPoint = { x: -2, y: 0 }
  fixture.netLabelPlacements[0]!.anchorPoint = anchorPoint
  fixture.netLabelPlacements[0]!.center = { x: -2, y: -0.2 }
  fixture.traces[0]!.tracePath = [anchorPoint, { x: 0, y: 0 }]
  fixture.completedTraceShifts = [
    {
      initialTrace: {
        ...fixture.traces[0]!,
        tracePath: [
          anchorPoint,
          { x: -2, y: -0.1 },
          { x: -0.2, y: -0.1 },
          { x: -0.2, y: 0 },
          { x: 0, y: 0 },
        ],
      },
      shiftedTracePath: structuredClone(fixture.traces[0]!.tracePath),
    },
  ]
  const before = structuredClone(fixture)
  const solver = new RailNetLabelCornerPlacementSolver(fixture)
  solver.solve()
  expect(fixture).toEqual(before)
  expect(solver.getOutput()).toEqual({
    traces: before.traces,
    netLabelPlacements: before.netLabelPlacements,
  })
})

for (const obstacle of [
  "chip",
  "text",
  "label",
  "parallel trace",
  "new crossing",
  "branch",
  "pin",
  "attached label",
]) {
  test(`preserves a detour blocked by a ${obstacle}`, () => {
    const fixture = createFixture()
    if (obstacle === "chip") {
      fixture.inputProblem.chips.push({
        chipId: "blocker",
        center: { x: -1, y: 0.05 },
        width: 0.2,
        height: 0.12,
        pins: [],
      })
    } else if (obstacle === "text") {
      fixture.inputProblem.textBoxes = [
        {
          center: { x: -2, y: 0.1 },
          width: 0.2,
          height: 0.22,
          text: "annotation",
        },
      ]
    } else if (obstacle === "label" || obstacle === "attached label") {
      fixture.netLabelPlacements.push({
        ...fixture.netLabelPlacements[0]!,
        globalConnNetId: obstacle === "label" ? "other" : "rail",
        pinIds: [],
        anchorPoint:
          obstacle === "label" ? { x: -2, y: 0.15 } : { x: -1, y: -0.1 },
        center: obstacle === "label" ? { x: -2, y: 0.15 } : { x: -1, y: -0.3 },
        height: 0.4,
      })
    } else if (obstacle === "pin") {
      fixture.inputProblem.chips.push({
        chipId: "load",
        center: { x: -1, y: -0.6 },
        width: 0.2,
        height: 1,
        pins: [{ pinId: "load.1", x: -1, y: -0.1 }],
      })
    } else {
      fixture.traces.push({
        ...fixture.traces[0]!,
        mspPairId: "other",
        globalConnNetId: obstacle === "branch" ? "rail" : "other",
        tracePath:
          obstacle === "parallel trace"
            ? [
                { x: -0.5, y: 0 },
                { x: -1.5, y: 0 },
              ]
            : obstacle === "new crossing"
              ? [
                  { x: -1, y: -0.05 },
                  { x: -1, y: 1 },
                ]
              : [
                  { x: -1, y: -0.1 },
                  { x: -1, y: -1 },
                ],
      })
    }
    const solver = new RailNetLabelCornerPlacementSolver(fixture)
    solver.solve()
    expect(solver.getOutput().traces[0]).toEqual(fixture.traces[0])
    expect(solver.getOutput().netLabelPlacements[0]).toEqual(
      fixture.netLabelPlacements[0],
    )
  })
}
