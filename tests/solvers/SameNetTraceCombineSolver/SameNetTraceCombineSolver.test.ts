import { describe, expect, test } from "bun:test"
import { SameNetTraceCombineSolver } from "lib/solvers/SameNetTraceCombineSolver/SameNetTraceCombineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const emptyInput: InputProblem = {
  chips: [],
  netConnections: [],
  directConnections: [],
  availableNetLabelOrientations: {},
}

const makePath = (
  overrides: Partial<SolvedTracePath> & {
    tracePath: { x: number; y: number }[]
  },
): SolvedTracePath =>
  ({
    mspPairId:
      overrides.mspPairId ?? `pair_${Math.random().toString(36).slice(2)}`,
    dcConnNetId: overrides.dcConnNetId ?? "dc_default",
    globalConnNetId: overrides.globalConnNetId ?? "GND",
    pins: overrides.pins ?? ([] as any),
    mspConnectionPairIds: overrides.mspConnectionPairIds ?? [],
    pinIds: overrides.pinIds ?? [],
    tracePath: overrides.tracePath,
  }) as SolvedTracePath

const solve = (
  paths: SolvedTracePath[],
  opts?: { axisSnapTolerance?: number },
) => {
  const solver = new SameNetTraceCombineSolver({
    inputProblem: emptyInput,
    inputTracePaths: paths,
    ...opts,
  })
  solver.solve()
  return solver
}

describe("SameNetTraceCombineSolver", () => {
  test("empty input solves immediately", () => {
    const solver = solve([])
    expect(solver.solved).toBe(true)
    expect(Object.keys(solver.correctedTraceMap)).toHaveLength(0)
  })

  test("single path with single segment passes through unchanged", () => {
    const path = makePath({
      mspPairId: "p1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    })
    const solver = solve([path])
    expect(solver.correctedTraceMap.p1!.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    expect(solver.stats.segmentsSnapped).toBe(0)
  })

  test("two near-collinear horizontal segments on same net snap to shared y", () => {
    // Sub-EPS jaggedness gets snapped at the default tolerance.
    const a = makePath({
      mspPairId: "a",
      globalConnNetId: "VCC",
      tracePath: [
        { x: 0, y: 5.0 },
        { x: 3, y: 5.0 },
      ],
    })
    const b = makePath({
      mspPairId: "b",
      globalConnNetId: "VCC",
      tracePath: [
        { x: 4, y: 5.001 },
        { x: 10, y: 5.001 },
      ],
    })
    const solver = solve([a, b])
    const aOut = solver.correctedTraceMap.a!.tracePath
    const bOut = solver.correctedTraceMap.b!.tracePath
    expect(aOut[0]!.y).toBeCloseTo(5.0005, 6)
    expect(aOut[1]!.y).toBeCloseTo(5.0005, 6)
    expect(bOut[0]!.y).toBeCloseTo(5.0005, 6)
    expect(bOut[1]!.y).toBeCloseTo(5.0005, 6)
    expect(solver.stats.segmentsSnapped).toBeGreaterThan(0)
  })

  test("vertical segments mirror the same behavior", () => {
    const a = makePath({
      mspPairId: "a",
      tracePath: [
        { x: 2.0, y: 0 },
        { x: 2.0, y: 4 },
      ],
    })
    const b = makePath({
      mspPairId: "b",
      tracePath: [
        { x: 2.001, y: 5 },
        { x: 2.001, y: 8 },
      ],
    })
    const solver = solve([a, b])
    const aOut = solver.correctedTraceMap.a!.tracePath
    const bOut = solver.correctedTraceMap.b!.tracePath
    expect(aOut[0]!.x).toBeCloseTo(2.0005, 6)
    expect(aOut[1]!.x).toBeCloseTo(2.0005, 6)
    expect(bOut[0]!.x).toBeCloseTo(2.0005, 6)
    expect(bOut[1]!.x).toBeCloseTo(2.0005, 6)
  })

  test("explicit wider tolerance combines visually-but-not-numerically close segments", () => {
    const a = makePath({
      mspPairId: "a",
      tracePath: [
        { x: 0, y: 5.0 },
        { x: 3, y: 5.0 },
      ],
    })
    const b = makePath({
      mspPairId: "b",
      tracePath: [
        { x: 4, y: 5.05 },
        { x: 10, y: 5.05 },
      ],
    })
    const solver = solve([a, b], { axisSnapTolerance: 0.1 })
    expect(solver.correctedTraceMap.a!.tracePath[0]!.y).toBeCloseTo(5.025, 6)
    expect(solver.correctedTraceMap.b!.tracePath[0]!.y).toBeCloseTo(5.025, 6)
  })

  test("segments on different nets are NOT snapped together", () => {
    const a = makePath({
      mspPairId: "a",
      globalConnNetId: "VCC",
      tracePath: [
        { x: 0, y: 5.0 },
        { x: 3, y: 5.0 },
      ],
    })
    const b = makePath({
      mspPairId: "b",
      globalConnNetId: "GND",
      tracePath: [
        { x: 4, y: 5.01 },
        { x: 10, y: 5.01 },
      ],
    })
    const solver = solve([a, b])
    expect(solver.correctedTraceMap.a!.tracePath[0]!.y).toBe(5.0)
    expect(solver.correctedTraceMap.b!.tracePath[0]!.y).toBeCloseTo(5.01, 9)
    expect(solver.stats.segmentsSnapped).toBe(0)
  })

  test("segments on same net but far apart on perpendicular axis are NOT combined", () => {
    const a = makePath({
      mspPairId: "a",
      tracePath: [
        { x: 0, y: 1 },
        { x: 5, y: 1 },
      ],
    })
    const b = makePath({
      mspPairId: "b",
      tracePath: [
        { x: 0, y: 10 },
        { x: 5, y: 10 },
      ],
    })
    const solver = solve([a, b])
    expect(solver.correctedTraceMap.a!.tracePath[0]!.y).toBe(1)
    expect(solver.correctedTraceMap.b!.tracePath[0]!.y).toBe(10)
    expect(solver.stats.segmentsSnapped).toBe(0)
  })

  test("diagonal segments are ignored (not horizontal nor vertical)", () => {
    const path = makePath({
      mspPairId: "p1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
    })
    const solver = solve([path])
    expect(solver.correctedTraceMap.p1!.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ])
  })

  test("collinear midpoints introduced by snapping are cleaned up", () => {
    // Path with sub-EPS jaggedness: snapping forces three points onto the
    // same y, so the middle one becomes redundant and is collapsed.
    const path = makePath({
      mspPairId: "p1",
      tracePath: [
        { x: 0, y: 3 },
        { x: 2, y: 3.0008 }, // jagged midpoint
        { x: 5, y: 3 },
      ],
    })
    const solver = solve([path])
    expect(solver.correctedTraceMap.p1!.tracePath.length).toBe(2)
    expect(solver.correctedTraceMap.p1!.tracePath[0]!.y).toBeCloseTo(
      solver.correctedTraceMap.p1!.tracePath[1]!.y,
      9,
    )
  })

  test("already-clean paths are not modified (anchor midpoints preserved)", () => {
    // Three already-collinear points: the upstream pipeline may keep a
    // midpoint as an anchor for label placement.  We must not strip it.
    const path = makePath({
      mspPairId: "p1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 5, y: 0 },
      ],
    })
    const solver = solve([path])
    expect(solver.correctedTraceMap.p1!.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 5, y: 0 },
    ])
  })

  test("multi-segment L-shape is preserved (corner is not collinear)", () => {
    const path = makePath({
      mspPairId: "p1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 3 },
      ],
    })
    const solver = solve([path])
    expect(solver.correctedTraceMap.p1!.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 3 },
    ])
  })

  test("re-running solver on already-clean output is idempotent", () => {
    const path = makePath({
      mspPairId: "p1",
      tracePath: [
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ],
    })
    const first = solve([path])
    const second = solve([first.correctedTraceMap.p1!])
    expect(second.correctedTraceMap.p1!.tracePath).toEqual(
      first.correctedTraceMap.p1!.tracePath,
    )
    expect(second.stats.segmentsSnapped).toBe(0)
    expect(second.stats.segmentsMerged).toBe(0)
  })

  test("input paths are not mutated (deep-copy semantics)", () => {
    const path = makePath({
      mspPairId: "p1",
      tracePath: [
        { x: 0, y: 5.0 },
        { x: 3, y: 5.0 },
      ],
    })
    const other = makePath({
      mspPairId: "p2",
      tracePath: [
        { x: 4, y: 5.01 },
        { x: 10, y: 5.01 },
      ],
    })
    const originalY = path.tracePath[0]!.y
    solve([path, other])
    expect(path.tracePath[0]!.y).toBe(originalY)
  })

  test("custom axisSnapTolerance widens / narrows the snap window", () => {
    const a = makePath({
      mspPairId: "a",
      tracePath: [
        { x: 0, y: 1 },
        { x: 3, y: 1 },
      ],
    })
    const b = makePath({
      mspPairId: "b",
      tracePath: [
        { x: 4, y: 1.2 },
        { x: 7, y: 1.2 },
      ],
    })
    // With default tolerance (2e-3), the gap is too wide → no snap.
    expect(solve([a, b]).stats.segmentsSnapped).toBe(0)
    // With tolerance 0.5, they snap together.
    const lenient = solve(
      [
        makePath({ ...a, tracePath: a.tracePath.map((p) => ({ ...p })) }),
        makePath({ ...b, tracePath: b.tracePath.map((p) => ({ ...p })) }),
      ],
      { axisSnapTolerance: 0.5 },
    )
    expect(lenient.stats.segmentsSnapped).toBeGreaterThan(0)
  })

  test("consecutive sub-EPS-jagged segments collapse into one after snapping", () => {
    const path = makePath({
      mspPairId: "p1",
      tracePath: [
        { x: 0, y: 5.0 },
        { x: 4, y: 5.0008 }, // sub-EPS jaggedness, both segments horizontal
        { x: 8, y: 5.0 },
      ],
    })
    const solver = solve([path])
    const out = solver.correctedTraceMap.p1!.tracePath
    expect(out.length).toBe(2)
    expect(out[0]!.y).toBeCloseTo(out[1]!.y, 9)
  })

  test("scales: 200 short segments on the same net complete in <500ms", () => {
    const paths: SolvedTracePath[] = []
    for (let i = 0; i < 200; i++) {
      paths.push(
        makePath({
          mspPairId: `p${i}`,
          tracePath: [
            { x: i * 2, y: 5 + (i % 3) * 0.001 },
            { x: i * 2 + 1, y: 5 + (i % 3) * 0.001 },
          ],
        }),
      )
    }
    const start = Date.now()
    const solver = solve(paths)
    const elapsed = Date.now() - start
    expect(solver.solved).toBe(true)
    expect(elapsed).toBeLessThan(500)
  })
})
