import { expect, test } from "bun:test"
import { SameNetTraceConsolidationSolver } from "lib/solvers/SameNetTraceConsolidationSolver/SameNetTraceConsolidationSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const trace = ({
  id,
  net = "net0",
  points,
}: {
  id: string
  net?: string
  points: Array<{ x: number; y: number }>
}): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: net,
    globalConnNetId: net,
    userNetId: net,
    pins: [
      { chipId: `${id}.chipA`, pinId: `${id}.pinA`, ...points[0]! },
      {
        chipId: `${id}.chipB`,
        pinId: `${id}.pinB`,
        ...points[points.length - 1]!,
      },
    ],
    pinIds: [`${id}.pinA`, `${id}.pinB`],
    mspConnectionPairIds: [id],
    tracePath: points,
  }) satisfies SolvedTracePath

const solve = (inputTraces: SolvedTracePath[]) => {
  const solver = new SameNetTraceConsolidationSolver({
    inputProblem,
    inputTraces,
    mergeDistance: 0.12,
    intervalGap: 0.12,
  })
  solver.solve()
  return solver.getOutput().correctedTraceMap
}

test("snaps a horizontal same-net internal segment to the longest nearby segment", () => {
  const output = solve([
    trace({
      id: "trunk",
      points: [
        { x: 0, y: 0 },
        { x: 0.4, y: 0 },
        { x: 0.4, y: 1 },
        { x: 2.4, y: 1 },
        { x: 2.4, y: 0 },
      ],
    }),
    trace({
      id: "branch",
      points: [
        { x: 0, y: 0.2 },
        { x: 0.4, y: 0.2 },
        { x: 0.4, y: 1.08 },
        { x: 2, y: 1.08 },
        { x: 2, y: 0.2 },
      ],
    }),
  ])

  expect(output.branch!.tracePath).toEqual([
    { x: 0, y: 0.2 },
    { x: 0.4, y: 0.2 },
    { x: 0.4, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 0.2 },
  ])
})

test("snaps a vertical same-net internal segment to the longest nearby segment", () => {
  const output = solve([
    trace({
      id: "trunk",
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 0.4 },
        { x: 1, y: 0.4 },
        { x: 1, y: 2.4 },
        { x: 0, y: 2.4 },
      ],
    }),
    trace({
      id: "branch",
      points: [
        { x: 0.2, y: 0 },
        { x: 0.2, y: 0.4 },
        { x: 1.08, y: 0.4 },
        { x: 1.08, y: 2 },
        { x: 0.2, y: 2 },
      ],
    }),
  ])

  expect(output.branch!.tracePath).toEqual([
    { x: 0.2, y: 0 },
    { x: 0.2, y: 0.4 },
    { x: 1, y: 0.4 },
    { x: 1, y: 2 },
    { x: 0.2, y: 2 },
  ])
})

test("does not consolidate nearby traces from different nets", () => {
  const branch = trace({
    id: "branch",
    net: "gnd",
    points: [
      { x: 0, y: 0.2 },
      { x: 0.4, y: 0.2 },
      { x: 0.4, y: 1.08 },
      { x: 2, y: 1.08 },
      { x: 2, y: 0.2 },
    ],
  })

  const output = solve([
    trace({
      id: "trunk",
      net: "vcc",
      points: [
        { x: 0, y: 0 },
        { x: 0.4, y: 0 },
        { x: 0.4, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
      ],
    }),
    branch,
  ])

  expect(output.branch!.tracePath).toEqual(branch.tracePath)
})

test("does not consolidate close segments whose projections are far apart", () => {
  const branch = trace({
    id: "branch",
    points: [
      { x: 2, y: 0.2 },
      { x: 2, y: 1.05 },
      { x: 3, y: 1.05 },
      { x: 3, y: 0.2 },
    ],
  })

  const output = solve([
    trace({
      id: "trunk",
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 0 },
      ],
    }),
    branch,
  ])

  expect(output.branch!.tracePath).toEqual(branch.tracePath)
})

test("uses a terminal jog without moving a pin anchor", () => {
  const output = solve([
    trace({
      id: "trunk",
      points: [
        { x: 0, y: 0 },
        { x: 0.2, y: 0 },
        { x: 0.2, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
      ],
    }),
    trace({
      id: "branch",
      points: [
        { x: 0, y: 1.08 },
        { x: 1.5, y: 1.08 },
        { x: 1.5, y: 0 },
      ],
    }),
  ])

  expect(output.branch!.tracePath[0]).toEqual({ x: 0, y: 1.08 })
  expect(output.branch!.tracePath.at(-1)).toEqual({ x: 1.5, y: 0 })
  expect(output.branch!.tracePath).toEqual([
    { x: 0, y: 1.08 },
    { x: 0, y: 1 },
    { x: 1.5, y: 1 },
    { x: 1.5, y: 0 },
  ])
})

test("does not move endpoint-only two-point traces", () => {
  const branch = trace({
    id: "branch",
    points: [
      { x: 0, y: 1.08 },
      { x: 2, y: 1.08 },
    ],
  })

  const output = solve([
    trace({
      id: "trunk",
      points: [
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ],
    }),
    branch,
  ])

  expect(output.branch!.tracePath).toEqual(branch.tracePath)
})

test("rejects snaps that would add a different-net intersection", () => {
  const branch = trace({
    id: "branch",
    points: [
      { x: 0, y: 0.2 },
      { x: 0.4, y: 0.2 },
      { x: 0.4, y: 1.08 },
      { x: 2, y: 1.08 },
      { x: 2, y: 0.2 },
    ],
  })

  const output = solve([
    trace({
      id: "trunk",
      points: [
        { x: 0, y: 0 },
        { x: 0.4, y: 0 },
        { x: 0.4, y: 1 },
        { x: 2.4, y: 1 },
        { x: 2.4, y: 0 },
      ],
    }),
    branch,
    trace({
      id: "crossing-net",
      net: "gnd",
      points: [
        { x: 1, y: 0.5 },
        { x: 1, y: 1.05 },
      ],
    }),
  ])

  expect(output.branch!.tracePath).toEqual(branch.tracePath)
})

test("uses current output traces when rejecting later cross-net intersections", () => {
  const movedDifferentNetTrace = trace({
    id: "a-gnd-branch",
    net: "a-gnd",
    points: [
      { x: 1, y: 0.96 },
      { x: 1.15, y: 0.96 },
      { x: 1.15, y: 1.04 },
      { x: 1, y: 1.04 },
    ],
  })
  const rejectedBranch = trace({
    id: "z-vcc-branch",
    net: "z-vcc",
    points: [
      { x: 1.24, y: 1.08 },
      { x: 1.5, y: 1.08 },
      { x: 1.5, y: 1.2 },
    ],
  })

  const output = solve([
    trace({
      id: "a-gnd-trunk",
      net: "a-gnd",
      points: [
        { x: 1.25, y: 0.6 },
        { x: 1.25, y: 0.9 },
      ],
    }),
    movedDifferentNetTrace,
    trace({
      id: "z-vcc-trunk",
      net: "z-vcc",
      points: [
        { x: 0, y: 0.4 },
        { x: 0.8, y: 0.4 },
        { x: 0.8, y: 1 },
        { x: 1.2, y: 1 },
        { x: 1.2, y: 0.4 },
      ],
    }),
    rejectedBranch,
  ])

  expect(output["a-gnd-branch"]!.tracePath).toEqual([
    { x: 1, y: 0.96 },
    { x: 1.25, y: 0.96 },
    { x: 1.25, y: 1.04 },
    { x: 1, y: 1.04 },
  ])
  expect(output["z-vcc-branch"]!.tracePath).toEqual(rejectedBranch.tracePath)
})

test("stops gracefully if the consolidation pass limit is reached", () => {
  const solver = new SameNetTraceConsolidationSolver({
    inputProblem,
    inputTraces: [],
  })
  ;(solver as any).applyNextConsolidationPass = () => true

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.error).toBe(null)
  expect(solver.stats.consolidationPassLimitExceeded).toBe(true)
  expect(solver.stats.consolidationPassCount).toBe(1000)
})

test("consolidates transitive chains deterministically", () => {
  const output = solve([
    trace({
      id: "a",
      points: [
        { x: 0, y: 0 },
        { x: 0.2, y: 0 },
        { x: 0.2, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
      ],
    }),
    trace({
      id: "b",
      points: [
        { x: 0, y: 0.2 },
        { x: 0.2, y: 0.2 },
        { x: 0.2, y: 1.08 },
        { x: 2, y: 1.08 },
        { x: 2, y: 0.2 },
      ],
    }),
    trace({
      id: "c",
      points: [
        { x: 0, y: 0.4 },
        { x: 0.2, y: 0.4 },
        { x: 0.2, y: 1.16 },
        { x: 2, y: 1.16 },
        { x: 2, y: 0.4 },
      ],
    }),
  ])

  expect(output.b!.tracePath.slice(2, 4)).toEqual([
    { x: 0.2, y: 1 },
    { x: 2, y: 1 },
  ])
  expect(output.c!.tracePath.slice(2, 4)).toEqual([
    { x: 0.2, y: 1 },
    { x: 2, y: 1 },
  ])
})
