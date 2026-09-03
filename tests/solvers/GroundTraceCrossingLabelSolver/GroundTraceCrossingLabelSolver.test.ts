import { expect, test } from "bun:test"
import { GroundTraceCrossingLabelSolver } from "lib/solvers/GroundTraceCrossingLabelSolver/GroundTraceCrossingLabelSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "G1",
      center: { x: -2, y: 0 },
      width: 0.4,
      height: 0.4,
      pins: [{ pinId: "G1.1", x: -1.8, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "G2",
      center: { x: 2, y: 0 },
      width: 0.4,
      height: 0.4,
      pins: [{ pinId: "G2.1", x: 1.8, y: 0, _facingDirection: "x-" }],
    },
    {
      chipId: "A",
      center: { x: -0.6, y: 1 },
      width: 0.4,
      height: 0.4,
      pins: [{ pinId: "A.1", x: -0.6, y: 0.8, _facingDirection: "y-" }],
    },
    {
      chipId: "B",
      center: { x: -0.6, y: -1 },
      width: 0.4,
      height: 0.4,
      pins: [{ pinId: "B.1", x: -0.6, y: -0.8, _facingDirection: "y+" }],
    },
    {
      chipId: "C",
      center: { x: 0.6, y: 1 },
      width: 0.4,
      height: 0.4,
      pins: [{ pinId: "C.1", x: 0.6, y: 0.8, _facingDirection: "y-" }],
    },
    {
      chipId: "D",
      center: { x: 0.6, y: -1 },
      width: 0.4,
      height: 0.4,
      pins: [{ pinId: "D.1", x: 0.6, y: -0.8, _facingDirection: "y+" }],
    },
  ],
  directConnections: [
    { pinIds: ["A.1", "B.1"], netId: "SIGNAL_A" },
    { pinIds: ["C.1", "D.1"], netId: "SIGNAL_B" },
  ],
  netConnections: [{ netId: "GND", pinIds: ["G1.1", "G2.1"], isGround: true }],
  availableNetLabelOrientations: { GND: ["y-"] },
  maxMspPairDistance: 5,
}

const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)

const createTrace = ({
  mspPairId,
  globalConnNetId,
  userNetId,
  pinIds,
  tracePath,
}: {
  mspPairId: string
  globalConnNetId: string
  userNetId: string
  pinIds: [string, string]
  tracePath: Array<{ x: number; y: number }>
}): SolvedTracePath => {
  const pins = inputProblem.chips
    .flatMap((chip) =>
      chip.pins.map((pin) => ({ ...pin, chipId: chip.chipId })),
    )
    .filter((pin) => pinIds.includes(pin.pinId))

  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    userNetId,
    pins: [pins[0]!, pins[1]!],
    pinIds,
    mspConnectionPairIds: [mspPairId],
    tracePath,
  }
}

const groundTrace = createTrace({
  mspPairId: "ground",
  globalConnNetId: netConnMap.getNetConnectedToId("GND")!,
  userNetId: "GND",
  pinIds: ["G1.1", "G2.1"],
  tracePath: [
    { x: -1.8, y: 0 },
    { x: 1.8, y: 0 },
  ],
})

const signalTraces = [
  createTrace({
    mspPairId: "signal-a",
    globalConnNetId: netConnMap.getNetConnectedToId("SIGNAL_A")!,
    userNetId: "SIGNAL_A",
    pinIds: ["A.1", "B.1"],
    tracePath: [
      { x: -0.6, y: 0.8 },
      { x: -0.6, y: -0.8 },
    ],
  }),
  createTrace({
    mspPairId: "signal-b",
    globalConnNetId: netConnMap.getNetConnectedToId("SIGNAL_B")!,
    userNetId: "SIGNAL_B",
    pinIds: ["C.1", "D.1"],
    tracePath: [
      { x: 0.6, y: 0.8 },
      { x: 0.6, y: -0.8 },
    ],
  }),
]

test("replaces a ground trace crossing two other nets with endpoint labels", () => {
  const beforeLabelSolver = new NetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: Object.fromEntries(
      [groundTrace, ...signalTraces].map((trace) => [trace.mspPairId, trace]),
    ),
  })
  beforeLabelSolver.solve()
  expect(beforeLabelSolver).toMatchSolverSnapshot(import.meta.path, "before")

  const crossingSolver = new GroundTraceCrossingLabelSolver({
    inputProblem,
    traces: [groundTrace, ...signalTraces],
  })
  crossingSolver.solve()

  expect(crossingSolver.outputTraces.map((trace) => trace.mspPairId)).toEqual([
    "signal-a",
    "signal-b",
  ])
  expect(crossingSolver.stats.removedGroundTraceCount).toBe(1)

  const labelSolver = new NetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: Object.fromEntries(
      crossingSolver.outputTraces.map((trace) => [trace.mspPairId, trace]),
    ),
  })
  labelSolver.solve()

  expect(
    labelSolver.netLabelPlacements
      .filter((label) => label.netId === "GND")
      .map((label) => label.pinIds),
  ).toEqual([["G1.1"], ["G2.1"]])
  expect(labelSolver).toMatchSolverSnapshot(import.meta.path, "after")
})

test("pipeline replaces a routed ground crossing with labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(
    solver.groundTraceCrossingLabelSolver?.stats.removedGroundTraceCount,
  ).toBe(1)
  expect(
    solver.netLabelToTraceSolver
      ?.getOutput()
      .netLabelPlacements.filter((label) => label.netId === "GND"),
  ).toHaveLength(2)
})

test("keeps a ground trace with one crossing", () => {
  const solver = new GroundTraceCrossingLabelSolver({
    inputProblem,
    traces: [groundTrace, signalTraces[0]!],
  })
  solver.solve()

  expect(solver.outputTraces).toContain(groundTrace)
  expect(solver.stats.removedGroundTraceCount).toBe(0)
})

test("keeps a ground trace crossing the same net twice", () => {
  const sameNetTraces = signalTraces.map((trace, index) => ({
    ...trace,
    globalConnNetId: signalTraces[0]!.globalConnNetId,
    userNetId: "SIGNAL_A",
    mspPairId: `same-net-${index}`,
  }))
  const solver = new GroundTraceCrossingLabelSolver({
    inputProblem,
    traces: [groundTrace, ...sameNetTraces],
  })
  solver.solve()

  expect(solver.outputTraces).toContain(groundTrace)
  expect(solver.stats.removedGroundTraceCount).toBe(0)
})

test("keeps a ground trace crossing one other trace twice", () => {
  const doubleCrossingTrace = {
    ...signalTraces[0]!,
    tracePath: [
      { x: -0.6, y: 0.8 },
      { x: -0.6, y: -0.4 },
      { x: 0.6, y: -0.4 },
      { x: 0.6, y: 0.8 },
    ],
  }
  const solver = new GroundTraceCrossingLabelSolver({
    inputProblem,
    traces: [groundTrace, doubleCrossingTrace],
  })
  solver.solve()

  expect(solver.outputTraces).toContain(groundTrace)
  expect(solver.stats.removedGroundTraceCount).toBe(0)
})

test("keeps an explicitly authored ground trace with two crossings", () => {
  const explicitGroundProblem = structuredClone(inputProblem)
  explicitGroundProblem.directConnections.push({
    pinIds: ["G1.1", "G2.1"],
    netId: "GND",
  })
  const explicitConnectivity = getConnectivityMapsFromInputProblem(
    explicitGroundProblem,
  )
  const explicitGroundTrace = {
    ...groundTrace,
    globalConnNetId:
      explicitConnectivity.netConnMap.getNetConnectedToId("GND")!,
  }

  const solver = new GroundTraceCrossingLabelSolver({
    inputProblem: explicitGroundProblem,
    traces: [explicitGroundTrace, ...signalTraces],
  })
  solver.solve()

  expect(solver.outputTraces).toContain(explicitGroundTrace)
  expect(solver.stats.removedGroundTraceCount).toBe(0)
})
