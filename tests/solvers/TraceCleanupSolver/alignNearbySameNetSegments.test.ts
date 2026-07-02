import { expect, test } from "bun:test"
import {
  getSvgFromGraphicsObject,
  stackGraphicsHorizontally,
  type GraphicsObject,
} from "graphics-debug"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [],
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    tracePath,
  }) as unknown as SolvedTracePath

const renderTraces = (traces: SolvedTracePath[]): GraphicsObject => ({
  lines: traces.map((trace, index) => ({
    points: trace.tracePath,
    strokeColor: index === 0 ? "blue" : "red",
  })),
  points: traces.flatMap((trace) =>
    trace.tracePath.map((point) => ({
      ...point,
      color: trace.globalConnNetId === "net1" ? "green" : "orange",
    })),
  ),
})

test("aligns close overlapping horizontal segments on the same net", () => {
  const [anchorTrace, adjustedTrace] = alignNearbySameNetSegments(
    [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 1.08 },
        { x: 3, y: 1.08 },
        { x: 3, y: 2 },
        { x: 5, y: 2 },
      ]),
    ],
    { maxAxisDistance: 0.1 },
  )

  expect(anchorTrace.tracePath[2].y).toBe(1)
  expect(adjustedTrace.tracePath[2].y).toBe(1)
  expect(adjustedTrace.tracePath[3].y).toBe(1)
})

test("renders before and after proof for same-net segment alignment", () => {
  const before = [
    makeTrace("a", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
    ]),
    makeTrace("b", "net1", [
      { x: 0, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 2 },
      { x: 5, y: 2 },
    ]),
  ]

  const after = alignNearbySameNetSegments(before, {
    maxAxisDistance: 0.1,
  })

  expect(after[1].tracePath[2].y).toBe(1)
  expect(after[1].tracePath[3].y).toBe(1)

  const proofSvg = getSvgFromGraphicsObject(
    stackGraphicsHorizontally([renderTraces(before), renderTraces(after)], {
      titles: ["Before", "After"],
    }),
    { backgroundColor: "white" },
  )

  expect(proofSvg).toMatchSvgSnapshot(import.meta.path, "before-after")
})

test("aligns close overlapping vertical segments on the same net", () => {
  const [, adjustedTrace] = alignNearbySameNetSegments(
    [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 4 },
        { x: 2, y: 4 },
      ]),
      makeTrace("b", "net1", [
        { x: 3, y: 0 },
        { x: 1.06, y: 0 },
        { x: 1.06, y: 3 },
        { x: 3, y: 3 },
      ]),
    ],
    { maxAxisDistance: 0.1 },
  )

  expect(adjustedTrace.tracePath[1].x).toBe(1)
  expect(adjustedTrace.tracePath[2].x).toBe(1)
})

test("does not align different nets", () => {
  const [, otherNetTrace] = alignNearbySameNetSegments(
    [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ]),
      makeTrace("b", "net2", [
        { x: 0, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 1.08 },
        { x: 3, y: 1.08 },
        { x: 3, y: 2 },
        { x: 5, y: 2 },
      ]),
    ],
    { maxAxisDistance: 0.1 },
  )

  expect(otherNetTrace.tracePath[2].y).toBe(1.08)
  expect(otherNetTrace.tracePath[3].y).toBe(1.08)
})

test("leaves endpoint segments in place", () => {
  const [firstTrace, secondTrace] = alignNearbySameNetSegments(
    [
      makeTrace("a", "net1", [
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 2 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 1.05 },
        { x: 3, y: 1.05 },
        { x: 3, y: 2 },
      ]),
    ],
    { maxAxisDistance: 0.1 },
  )

  expect(firstTrace.tracePath[0].y).toBe(1)
  expect(firstTrace.tracePath[1].y).toBe(1)
  expect(secondTrace.tracePath[0].y).toBe(1.05)
  expect(secondTrace.tracePath[1].y).toBe(1.05)
})

test("skips same-net alignment when it would overlap a different net", () => {
  const [, adjustedTrace] = alignNearbySameNetSegments(
    [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 1.08 },
        { x: 3, y: 1.08 },
        { x: 3, y: 2 },
        { x: 5, y: 2 },
      ]),
      makeTrace("c", "net2", [
        { x: 2.2, y: 1 },
        { x: 2.8, y: 1 },
      ]),
    ],
    { maxAxisDistance: 0.1 },
  )

  expect(adjustedTrace.tracePath[2].y).toBe(1.08)
  expect(adjustedTrace.tracePath[3].y).toBe(1.08)
})
