import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { NetLabelTraceCollisionSolver } from "lib/solvers/NetLabelTraceCollisionSolver/NetLabelTraceCollisionSolver"
import { findObstacleAwareDetour } from "lib/solvers/NetLabelTraceCollisionSolver/findObstacleAwareDetour"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import type { InputProblem } from "lib/types/InputProblem"
import fixture from "./blocked-wiper-rail.json"
import fullFixture from "./atmega-wiper-rail.json"

const RAIL_ID = "schematic_port_36-schematic_port_17"
const clone = () =>
  structuredClone(fixture) as unknown as ConstructorParameters<
    typeof NetLabelTraceCollisionSolver
  >[0]
const collisions = (
  output: ReturnType<NetLabelTraceCollisionSolver["getOutput"]>,
) =>
  getOutputLabelCollisions({ ...output, inlineNetLabelPlacements: [] }).filter(
    (c) =>
      c.kind === "trace-label" &&
      c.trace.kind === "routed" &&
      c.trace.id === RAIL_ID,
  )
const identity = (trace: (typeof fixture.traces)[number]) => {
  const { tracePath, ...rest } = trace
  return rest
}
const checkGeometry = (
  input: ReturnType<typeof clone>,
  output: ReturnType<NetLabelTraceCollisionSolver["getOutput"]>,
) => {
  const rail = output.traces.find((t) => t.mspPairId === RAIL_ID)!
  const original = input.traces.find((t) => t.mspPairId === RAIL_ID)!
  expect(identity(rail as (typeof fixture.traces)[number])).toEqual(
    identity(original as (typeof fixture.traces)[number]),
  )
  expect(rail.tracePath[0]).toEqual(original.tracePath[0])
  expect(rail.tracePath.at(-1)).toEqual(original.tracePath.at(-1))
  expect(output.netLabelPlacements).toEqual(input.netLabelPlacements)
  expect(output.traces.filter((t) => t.mspPairId !== RAIL_ID)).toEqual(
    input.traces.filter((t) => t.mspPairId !== RAIL_ID),
  )
  expect(collisions(output)).toEqual([])
  for (const pin of rail.pins)
    expect(tracePathContainsPoint(rail.tracePath, pin)).toBe(true)
  const otherTraces = input.traces.filter(
    (t) => t.globalConnNetId !== rail.globalConnNetId,
  )
  const foreignLabels = input.netLabelPlacements.filter(
    (l) => l.globalConnNetId !== rail.globalConnNetId,
  )
  for (let i = 1; i < rail.tracePath.length; i++) {
    const a = rail.tracePath[i - 1]!,
      b = rail.tracePath[i]!
    expect(Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6).toBe(true)
    for (const obstacle of getObstacleRects(input.inputProblem)) {
      expect(segmentIntersectsRect(a, b, obstacle)).toBe(false)
      const terminal =
        i === 1
          ? rail.tracePath[0]!
          : i === rail.tracePath.length - 1
            ? rail.tracePath.at(-1)!
            : null
      const ownedTerminal =
        obstacle.kind === "chip" &&
        terminal &&
        rail.pins.some(
          (pin) =>
            pin.chipId === obstacle.chipId &&
            Math.hypot(pin.x - terminal.x, pin.y - terminal.y) < 1e-6,
        )
      if (!ownedTerminal)
        expect(
          segmentIntersectsRect(a, b, {
            minX: obstacle.minX - 0.059,
            maxX: obstacle.maxX + 0.059,
            minY: obstacle.minY - 0.059,
            maxY: obstacle.maxY + 0.059,
          }),
        ).toBe(false)
    }
    for (const label of foreignLabels) {
      const r = getAnchoredNetLabelRenderedBounds(label)
      expect(
        segmentIntersectsRect(a, b, {
          minX: r.minX - 0.059,
          maxX: r.maxX + 0.059,
          minY: r.minY - 0.059,
          maxY: r.maxY + 0.059,
        }),
      ).toBe(false)
    }
    for (const other of otherTraces)
      for (let j = 1; j < other.tracePath.length; j++) {
        const c = other.tracePath[j - 1]!,
          d = other.tracePath[j]!
        expect(
          segmentIntersectsRect(a, b, {
            minX: Math.min(c.x, d.x) - 0.059,
            maxX: Math.max(c.x, d.x) + 0.059,
            minY: Math.min(c.y, d.y) - 0.059,
            maxY: Math.max(c.y, d.y) + 0.059,
          }),
        ).toBe(false)
      }
  }
  for (const other of otherTraces)
    expect(
      findPerpendicularPathCrossings(rail.tracePath, other.tracePath, {
        includeTerminalSegments: true,
      }),
    ).toEqual([])
}

test("late fallback clears adjacent wiper labels when normal detours hit a component", () => {
  const input = clone()
  const snapshot = structuredClone(input)
  const legacy = new NetLabelTraceCollisionSolver(structuredClone(input))
  legacy.solve()
  expect(collisions(legacy.getOutput())).toHaveLength(2)
  const solver = new NetLabelTraceCollisionSolver({
    ...input,
    allowObstacleAwareDetours: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  checkGeometry(input, solver.getOutput())
  expect(input).toEqual(snapshot)
  expect(solver.completedReroutes).toHaveLength(1)
  const replay = new NetLabelTraceCollisionSolver(
    structuredClone(solver.getConstructorParams()),
  )
  replay.solve()
  expect(replay.getOutput()).toEqual(solver.getOutput())
  const alreadySolved = new NetLabelTraceCollisionSolver({
    ...solver.getOutput(),
    inputProblem: input.inputProblem,
    allowObstacleAwareDetours: true,
  })
  alreadySolved.solve()
  expect(alreadySolved.getOutput().traces).toEqual(solver.getOutput().traces)
  expect(alreadySolved.completedReroutes).toHaveLength(0)
})

test("fallback preserves a same-net branch junction and host label anchor", () => {
  const input = clone()
  const host = input.traces[0]!
  const junction = { x: 12.219000000000001, y: 15 }
  input.traces.push({
    ...host,
    mspPairId: "branch",
    mspConnectionPairIds: ["branch"],
    pinIds: [],
    pins: [
      { ...host.pins[0], ...junction },
      { ...host.pins[1], x: 12.8, y: 15 },
    ],
    tracePath: [junction, { x: 12.8, y: 15 }],
  })
  const anchor = { x: 12.219000000000001, y: 16 }
  input.netLabelPlacements.push({
    globalConnNetId: host.globalConnNetId,
    netId: "rail",
    mspConnectionPairIds: [host.mspPairId],
    pinIds: [...host.pinIds],
    orientation: "y+",
    anchorPoint: anchor,
    center: { x: anchor.x, y: anchor.y + 0.21 },
    width: 0.96,
    height: 0.42,
  })
  const solver = new NetLabelTraceCollisionSolver({
    ...input,
    allowObstacleAwareDetours: true,
  })
  solver.solve()
  checkGeometry(input, solver.getOutput())
  const route = solver
    .getOutput()
    .traces.find((t) => t.mspPairId === RAIL_ID)!.tracePath
  expect(tracePathContainsPoint(route, junction)).toBe(true)
  expect(tracePathContainsPoint(route, anchor)).toBe(true)
})

test("no safe detour preserves the original connected route and unresolved conflict", () => {
  const input = clone()
  const rail = input.traces[0]!
  // This required same-net junction lies inside the foreign label. Moving or
  // detaching it would falsely make the route look clear.
  const junction = { x: 12.219000000000001, y: 14.15 }
  input.traces.push({
    ...rail,
    mspPairId: "blocked-branch",
    mspConnectionPairIds: ["blocked-branch"],
    pinIds: [],
    pins: [
      { ...rail.pins[0], ...junction },
      { ...rail.pins[1], x: 13.1, y: 14.15 },
    ],
    tracePath: [junction, { x: 13.1, y: 14.15 }],
  })
  expect(
    findObstacleAwareDetour({
      trace: rail,
      inputProblem: input.inputProblem,
      traces: input.traces,
      labels: input.netLabelPlacements,
    }),
  ).toBeNull()
  const solver = new NetLabelTraceCollisionSolver({
    ...input,
    allowObstacleAwareDetours: true,
  })
  solver.solve()
  expect(solver.getOutput().traces).toEqual(input.traces)
  expect(collisions(solver.getOutput())).toHaveLength(2)
  expect(solver.completedReroutes).toHaveLength(0)
})

test("fallback leaves an escape blocked by a foreign-net terminal untouched", () => {
  const input = clone()
  const rail = input.traces[0]!
  const start = rail.tracePath[0]!
  input.traces.push({
    ...rail,
    mspPairId: "foreign-terminal",
    globalConnNetId: "other-net",
    pinIds: [],
    pins: [
      { ...rail.pins[0], x: start.x - 0.2, y: start.y - 1 },
      { ...rail.pins[1], x: start.x - 0.2, y: start.y + 1 },
    ],
    tracePath: [
      { x: start.x - 0.2, y: start.y - 1 },
      { x: start.x - 0.2, y: start.y + 1 },
    ],
  })
  // The fixed x- escape from the capacitor cannot turn before the blocker
  // while maintaining chip and other-net drawing clearance.
  const path = findObstacleAwareDetour({
    trace: rail,
    inputProblem: input.inputProblem,
    traces: input.traces,
    labels: input.netLabelPlacements,
  })
  expect(path).toBeNull()
})

for (const transform of ["mirror", "rotate"] as const)
  test(`bounded detours support ${transform} geometry without net-name assumptions`, () => {
    const input = clone()
    const point = (p: { x: number; y: number }) =>
      transform === "mirror" ? { x: -p.x, y: p.y } : { x: -p.y, y: p.x }
    const dir = (d: string) =>
      transform === "mirror"
        ? ({ "x+": "x-", "x-": "x+", "y+": "y+", "y-": "y-" } as const)[
            d as "x+"
          ]
        : ({ "x+": "y+", "x-": "y-", "y+": "x-", "y-": "x+" } as const)[
            d as "x+"
          ]
    for (const chip of input.inputProblem.chips) {
      chip.center = point(chip.center)
      if (transform === "rotate")
        [chip.width, chip.height] = [chip.height, chip.width]
      for (const pin of chip.pins) {
        Object.assign(pin, point(pin))
        if (pin._facingDirection)
          pin._facingDirection = dir(pin._facingDirection)
      }
    }
    for (const trace of input.traces) {
      trace.tracePath = trace.tracePath.map(point)
      for (const pin of trace.pins) {
        Object.assign(pin, point(pin))
        if (pin._facingDirection)
          pin._facingDirection = dir(pin._facingDirection)
      }
    }
    for (const label of input.netLabelPlacements) {
      label.center = point(label.center)
      label.anchorPoint = point(label.anchorPoint)
      label.orientation = dir(label.orientation)
      label.netId = "opaque"
      if (transform === "rotate")
        [label.width, label.height] = [label.height, label.width]
    }
    const solver = new NetLabelTraceCollisionSolver({
      ...input,
      allowObstacleAwareDetours: true,
    })
    solver.solve()
    checkGeometry(input, solver.getOutput())
  })

test("ATmega full pipeline keeps the safe rail through final routing and inline recovery", () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(fullFixture[0]) as unknown as InputProblem,
  )
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const stage = solver.netLabelTraceCollisionSolver!
  checkGeometry(stage.getConstructorParams(), stage.getOutput())
  const original = stage.traces.find((t) => t.mspPairId === RAIL_ID)!
  const output = solver.netLabelToTraceSolver!.getOutput()
  const rail = output.traces.find((t) => t.mspPairId === RAIL_ID)!
  expect(identity(rail as (typeof fixture.traces)[number])).toEqual(
    identity(original as (typeof fixture.traces)[number]),
  )
  expect(rail.tracePath).toEqual(
    stage.getOutput().traces.find((t) => t.mspPairId === RAIL_ID)!.tracePath,
  )
  expect(
    getOutputLabelCollisions(output).filter(
      (c) =>
        c.kind === "trace-label" &&
        c.trace.kind === "routed" &&
        c.trace.id === RAIL_ID,
    ),
  ).toEqual([])
  const repeat = new SchematicTracePipelineSolver(
    structuredClone(fullFixture[0]) as unknown as InputProblem,
  )
  repeat.solve()
  expect(repeat.netLabelToTraceSolver!.getOutput()).toEqual(output)
})
