import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as any

test("aligns overlapping internal horizontal same-net segments", () => {
  const { traces, changed } = alignNearbySameNetSegments({
    inputProblem,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 2 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 3 },
        { x: 0, y: 1.08 },
        { x: 5, y: 1.08 },
        { x: 5, y: 4 },
      ]),
    ],
  })

  expect(changed).toBe(true)
  expect(traces[1]!.tracePath[1]!.y).toBe(1)
  expect(traces[1]!.tracePath[2]!.y).toBe(1)
})

test("aligns overlapping internal vertical same-net segments", () => {
  const { traces, changed } = alignNearbySameNetSegments({
    inputProblem,
    traces: [
      makeTrace("a", "net1", [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 5 },
        { x: 2, y: 5 },
      ]),
      makeTrace("b", "net1", [
        { x: -2, y: 0 },
        { x: 1.08, y: 0 },
        { x: 1.08, y: 5 },
        { x: 3, y: 5 },
      ]),
    ],
  })

  expect(changed).toBe(true)
  expect(traces[1]!.tracePath[1]!.x).toBe(1)
  expect(traces[1]!.tracePath[2]!.x).toBe(1)
})

test("does not align different-net segments", () => {
  const { traces, changed } = alignNearbySameNetSegments({
    inputProblem,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 2 },
      ]),
      makeTrace("b", "net2", [
        { x: 0, y: 3 },
        { x: 0, y: 1.08 },
        { x: 5, y: 1.08 },
        { x: 5, y: 4 },
      ]),
    ],
  })

  expect(changed).toBe(false)
  expect(traces[1]!.tracePath[1]!.y).toBe(1.08)
  expect(traces[1]!.tracePath[2]!.y).toBe(1.08)
})

test("preserves endpoint segments", () => {
  const { traces, changed } = alignNearbySameNetSegments({
    inputProblem,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 2 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 1.08 },
        { x: 5, y: 1.08 },
        { x: 5, y: 4 },
      ]),
    ],
  })

  expect(changed).toBe(false)
  expect(traces[1]!.tracePath[0]!.y).toBe(1.08)
  expect(traces[1]!.tracePath[1]!.y).toBe(1.08)
})
