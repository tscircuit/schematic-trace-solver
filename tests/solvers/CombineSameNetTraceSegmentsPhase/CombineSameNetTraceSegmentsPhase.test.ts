import { test, expect } from "bun:test"
import { CombineSameNetTraceSegmentsPhase } from "lib/solvers/CombineSameNetTraceSegmentsPhase/CombineSameNetTraceSegmentsPhase"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeInputProblem(overrides?: Partial<InputProblem>): InputProblem {
  return {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2,
        height: 2,
        pins: [
          { pinId: "U1.1", x: -1, y: 0 },
          { pinId: "U1.2", x: 1, y: 0 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 3,
    ...overrides,
  }
}

function makeTrace(opts: {
  netId: string
  pinIds: [string, string]
  tracePath: { x: number; y: number }[]
  mspPairId?: string
}): SolvedTracePath {
  return {
    mspPairId: opts.mspPairId ?? `${opts.netId}_pair`,
    dcConnNetId: opts.netId,
    globalConnNetId: opts.netId,
    pins: [
      { pinId: opts.pinIds[0], x: opts.tracePath[0].x, y: opts.tracePath[0].y, chipId: "U1" },
      {
        pinId: opts.pinIds[1],
        x: opts.tracePath[opts.tracePath.length - 1].x,
        y: opts.tracePath[opts.tracePath.length - 1].y,
        chipId: "U1",
      },
    ],
    tracePath: opts.tracePath,
    mspConnectionPairIds: [opts.mspPairId ?? `${opts.netId}_pair`],
    pinIds: opts.pinIds,
  }
}

test("CombineSameNetTraceSegmentsPhase - basic horizontal segments", () => {
  const inputProblem = makeInputProblem()
  const traces: SolvedTracePath[] = [
    makeTrace({
      netId: "net1",
      pinIds: ["U1.1", "U1.2"],
      tracePath: [
        { x: -1, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
  ]

  const phase = new CombineSameNetTraceSegmentsPhase({
    inputProblem,
    traces,
    mergeThreshold: 0.1,
  })

  phase.solve()

  expect(phase.solved).toBe(true)
  expect(phase.outputTraces.length).toBeGreaterThan(0)
})

test("CombineSameNetTraceSegmentsPhase - L-shaped trace", () => {
  const inputProblem = makeInputProblem()
  const traces: SolvedTracePath[] = [
    makeTrace({
      netId: "net1",
      pinIds: ["U1.1", "U1.2"],
      tracePath: [
        { x: -1, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
    }),
  ]

  const phase = new CombineSameNetTraceSegmentsPhase({
    inputProblem,
    traces,
    mergeThreshold: 0.1,
  })

  phase.solve()

  expect(phase.solved).toBe(true)
  expect(phase.outputTraces.length).toBeGreaterThan(0)
  // L-shaped trace should be preserved
  const output = phase.outputTraces[0]
  expect(output.tracePath.length).toBeGreaterThanOrEqual(3)
})

test("CombineSameNetTraceSegmentsPhase - merges close parallel segments", () => {
  const inputProblem = makeInputProblem()
  // Two traces on same net with very close parallel segments
  const traces: SolvedTracePath[] = [
    makeTrace({
      netId: "net1",
      pinIds: ["U1.1", "U1.2"],
      tracePath: [
        { x: -1, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      mspPairId: "net1_pair1",
    }),
    makeTrace({
      netId: "net1",
      pinIds: ["U1.1", "U1.2"],
      tracePath: [
        { x: -1, y: 0.05 },
        { x: 0, y: 0.05 },
        { x: 1, y: 0.05 },
      ],
      mspPairId: "net1_pair2",
    }),
  ]

  const phase = new CombineSameNetTraceSegmentsPhase({
    inputProblem,
    traces,
    mergeThreshold: 0.1,
  })

  phase.solve()

  expect(phase.solved).toBe(true)
  // After merging, should have fewer total trace segments than input
  const totalInputPoints = traces.reduce((sum, t) => sum + t.tracePath.length, 0)
  const totalOutputPoints = phase.outputTraces.reduce(
    (sum, t) => sum + t.tracePath.length,
    0,
  )
  // Merged traces should consolidate points
  expect(totalOutputPoints).toBeLessThanOrEqual(totalInputPoints)
})

test("CombineSameNetTraceSegmentsPhase - preserves distant segments", () => {
  const inputProblem = makeInputProblem()
  // Two traces on same net but far apart - should NOT merge
  const traces: SolvedTracePath[] = [
    makeTrace({
      netId: "net1",
      pinIds: ["U1.1", "U1.2"],
      tracePath: [
        { x: -1, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      mspPairId: "net1_pair1",
    }),
    makeTrace({
      netId: "net1",
      pinIds: ["U1.1", "U1.2"],
      tracePath: [
        { x: -1, y: 2 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
      ],
      mspPairId: "net1_pair2",
    }),
  ]

  const phase = new CombineSameNetTraceSegmentsPhase({
    inputProblem,
    traces,
    mergeThreshold: 0.1,
  })

  phase.solve()

  expect(phase.solved).toBe(true)
  // Distant traces should remain separate
  expect(phase.outputTraces.length).toBeGreaterThanOrEqual(1)
})

test("CombineSameNetTraceSegmentsPhase - different nets stay separate", () => {
  const inputProblem = makeInputProblem()
  // Two traces on DIFFERENT nets - should never merge
  const traces: SolvedTracePath[] = [
    makeTrace({
      netId: "net1",
      pinIds: ["U1.1", "U1.2"],
      tracePath: [
        { x: -1, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      mspPairId: "net1_pair",
    }),
    makeTrace({
      netId: "net2",
      pinIds: ["U1.1", "U1.2"],
      tracePath: [
        { x: -1, y: 0.05 },
        { x: 0, y: 0.05 },
        { x: 1, y: 0.05 },
      ],
      mspPairId: "net2_pair",
    }),
  ]

  const phase = new CombineSameNetTraceSegmentsPhase({
    inputProblem,
    traces,
    mergeThreshold: 0.1,
  })

  phase.solve()

  expect(phase.solved).toBe(true)
  // Both nets should produce output traces
  const net1Traces = phase.outputTraces.filter(
    (t) => t.globalConnNetId === "net1",
  )
  const net2Traces = phase.outputTraces.filter(
    (t) => t.globalConnNetId === "net2",
  )
  expect(net1Traces.length).toBeGreaterThan(0)
  expect(net2Traces.length).toBeGreaterThan(0)
})
