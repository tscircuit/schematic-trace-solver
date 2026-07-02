import { expect, test } from "bun:test"
import { mergeSameNetNearCollinearSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetNearCollinearSegments"

const emptyProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 2,
} as any

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
) =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    userNetId: undefined,
    pins: [] as any,
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath,
  }) as any

const run = (traces: any[]) =>
  mergeSameNetNearCollinearSegments({
    traces,
    inputProblem: emptyProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })

test("snaps a free interior segment onto a pin-anchored run", () => {
  // trace A: interior vertical at x=3.6 (terminals at x=3.8)
  // trace B: interior vertical at x=3.5256 — same net, ranges touch at y=0
  const traceA = makeTrace("A", "net1", [
    { x: 3.8, y: -0.9 },
    { x: 3.6, y: -0.9 },
    { x: 3.6, y: 0 },
    { x: 3.8, y: 0 },
  ])
  const traceB = makeTrace("B", "net1", [
    { x: 3.25, y: 1.3 },
    { x: 3.5256, y: 1.3 },
    { x: 3.5256, y: 0 },
    { x: 3.8, y: 0 },
  ])

  const [a, b] = run([traceA, traceB])

  // B's vertical is the longest run in the cluster → both verticals at its x
  const xsA = a!.tracePath.map((p: any) => p.x)
  expect(xsA).toContain(3.5256)
  expect(xsA).not.toContain(3.6)
  // B unchanged
  expect(b!.tracePath.map((p: any) => p.x)).toContain(3.5256)
})

test("does not merge segments on different nets", () => {
  const traceA = makeTrace("A", "net1", [
    { x: 0, y: 1 },
    { x: 0.05, y: 1 },
    { x: 0.05, y: 2 },
    { x: 0.5, y: 2 },
  ])
  const traceB = makeTrace("B", "net2", [
    { x: 0, y: 3 },
    { x: 0.0, y: 3 },
    { x: 0.0, y: 2 },
    { x: 0.5, y: 2 },
  ])
  const before = JSON.stringify([traceA.tracePath, traceB.tracePath])
  const [a, b] = run([traceA, traceB])
  expect(JSON.stringify([a!.tracePath, b!.tracePath])).toBe(before)
})

test("preserves a legitimate step between pins at different coordinates", () => {
  // Both horizontal runs contain a path terminal (a pin) — the pins sit at
  // y=0 and y=0.08. A merge would disconnect a pin. Must be skipped even
  // though the offset (0.08) is below the threshold.
  const trace = makeTrace("A", "net1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0.08 },
    { x: 2, y: 0.08 },
  ])
  const [result] = run([trace])
  expect(result!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0.08 },
    { x: 2, y: 0.08 },
  ])
})

test("does not merge segments further apart than the threshold", () => {
  // 0.2 offset = typical pin pitch — legitimate parallel rails
  const traceA = makeTrace("A", "net1", [
    { x: 0, y: 0.5 },
    { x: 0.2, y: 0.5 },
    { x: 0.2, y: 0 },
    { x: 1, y: 0 },
  ])
  const traceB = makeTrace("B", "net1", [
    { x: 0, y: 0.5 },
    { x: 0.4, y: 0.5 },
    { x: 0.4, y: 0.2 },
    { x: 1, y: 0.2 },
  ])
  const before = JSON.stringify([traceA.tracePath, traceB.tracePath])
  const [a, b] = run([traceA, traceB])
  expect(JSON.stringify([a!.tracePath, b!.tracePath])).toBe(before)
})

test("collapses the vestigial stub after merging (path is simplified)", () => {
  // interior jog inside a single trace: two horizontals 0.05 apart joined
  // by a tiny vertical stub; the long run is pin-anchored at y=0... both
  // ends of the SECOND run are free (neither contains a terminal)
  const trace = makeTrace("A", "net1", [
    { x: 0, y: 1 }, // terminal
    { x: 0.5, y: 1 }, // vertical down to the rail follows
    { x: 0.5, y: 0.05 },
    { x: 1.5, y: 0.05 }, // free horizontal run, 0.05 off the anchored one
    { x: 1.5, y: 0 },
    { x: 2.5, y: 0 }, // anchored horizontal run (contains terminal)
  ])
  const [result] = run([trace])
  const ys = result!.tracePath.map((p: any) => p.y)
  // free run snapped onto the anchored rail at y=0
  expect(ys).not.toContain(0.05)
  // stub collapsed → fewer points than before
  expect(result!.tracePath.length).toBeLessThan(6)
})
