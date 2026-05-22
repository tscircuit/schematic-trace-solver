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
