import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import { collapseNearParallelSameNetCycles } from "lib/solvers/SameNetJunctionAlignmentSolver/collapseNearParallelSameNetCycles"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getVisibleTraceLength } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { PinId } from "lib/types/InputProblem"

const createTrace = ({
  id,
  net = "same-net",
  path,
}: {
  id: string
  net?: string
  path: Point[]
}): SolvedTracePath => ({
  mspPairId: id,
  dcConnNetId: net,
  globalConnNetId: net,
  pins: [
    {
      pinId: `${id}-start` as PinId,
      chipId: `${id}-start-chip`,
      ...path[0]!,
    },
    {
      pinId: `${id}-end` as PinId,
      chipId: `${id}-end-chip`,
      ...path.at(-1)!,
    },
  ],
  tracePath: path,
  mspConnectionPairIds: [id],
  pinIds: [`${id}-start` as PinId, `${id}-end` as PinId],
})

const collapse = (traces: SolvedTracePath[]) =>
  collapseNearParallelSameNetCycles({
    traces,
    netLabelPlacements: [],
    inlineNetLabelPlacements: [],
  })

test("collapses only the redundant bridge onto an existing same-net rail", () => {
  const traces = [
    createTrace({
      id: "bottom",
      path: [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    createTrace({
      id: "top-and-donor",
      path: [
        { x: 1, y: 2 },
        { x: 0, y: 2 },
        { x: 0, y: 0 },
      ],
    }),
    createTrace({
      id: "redundant-bridge",
      path: [
        { x: 0.025, y: 0 },
        { x: 0.025, y: 2 },
      ],
    }),
  ]

  const result = collapse(traces)

  expect(result.collapsedCycleCount).toBe(1)
  expect(result.traces[2]!.mspPairId).toBe("redundant-bridge")
  expect(result.traces[2]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 2 },
  ])
  expect(getVisibleTraceLength(result.traces)).toBeLessThan(
    getVisibleTraceLength(traces),
  )
})

test("keeps a nearby rail when either endpoint is not already connected", () => {
  const traces = [
    createTrace({
      id: "donor",
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
      ],
    }),
    createTrace({
      id: "required-route",
      path: [
        { x: 0.025, y: 0 },
        { x: 0.025, y: 2 },
      ],
    }),
  ]

  expect(collapse(traces)).toEqual({ traces, collapsedCycleCount: 0 })
})

test("keeps a bridge when its endpoint traces do not reach the donor", () => {
  const traces = [
    createTrace({
      id: "donor",
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
      ],
    }),
    createTrace({
      id: "bottom-island",
      path: [
        { x: 0.025, y: 0 },
        { x: 0.04, y: 0 },
      ],
    }),
    createTrace({
      id: "top-island",
      path: [
        { x: 0.025, y: 2 },
        { x: 0.04, y: 2 },
      ],
    }),
    createTrace({
      id: "target",
      path: [
        { x: 0.025, y: 0 },
        { x: 0.025, y: 2 },
      ],
    }),
  ]

  expect(collapse(traces)).toEqual({ traces, collapsedCycleCount: 0 })
})

test("keeps partial overlaps and traces from different nets", () => {
  const traces = [
    createTrace({
      id: "bottom",
      path: [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    createTrace({
      id: "top",
      path: [
        { x: -1, y: 2 },
        { x: 1, y: 2 },
      ],
    }),
    createTrace({
      id: "partial-donor",
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
    }),
    createTrace({
      id: "other-net-donor",
      net: "other-net",
      path: [
        { x: 0.01, y: 0 },
        { x: 0.01, y: 2 },
      ],
    }),
    createTrace({
      id: "target",
      path: [
        { x: 0.025, y: 0 },
        { x: 0.025, y: 2 },
      ],
    }),
  ]

  expect(collapse(traces)).toEqual({ traces, collapsedCycleCount: 0 })
})
