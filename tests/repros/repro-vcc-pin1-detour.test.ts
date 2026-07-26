import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "J1",
      center: { x: -1.8, y: 0.5 },
      width: 0.6,
      height: 0.4,
      pins: [
        {
          pinId: "J1.1",
          x: -1.5,
          y: 0.5,
          _facingDirection: "x+",
        },
      ],
    },
    {
      chipId: "U1",
      center: { x: 0, y: 0.25 },
      width: 1,
      height: 1.5,
      pins: [
        {
          pinId: "U1.1",
          x: -0.5,
          y: 0.5,
          _facingDirection: "x-",
        },
        {
          pinId: "U1.6",
          x: -0.5,
          y: 0,
          _facingDirection: "x-",
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "VCC",
      pinIds: ["J1.1", "U1.1", "U1.6"],
      netLabelWidth: 0.48,
      netLabelHeight: 0.42,
    },
  ],
  textBoxes: [],
  availableNetLabelOrientations: { VCC: ["y+"] },
}

const pin = (chipId: "J1" | "U1", pinId: string) => ({
  ...inputProblem.chips
    .find((chip) => chip.chipId === chipId)!
    .pins.find((candidate) => candidate.pinId === pinId)!,
  chipId,
})

const createTrace = ({
  mspPairId,
  pins,
  tracePath,
  globalConnNetId = "vcc-net",
  userNetId = "VCC",
}: {
  mspPairId: string
  pins: [InputPin & { chipId: string }, InputPin & { chipId: string }]
  tracePath: SolvedTracePath["tracePath"]
  globalConnNetId?: string
  userNetId?: string
}): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  userNetId,
  pins,
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: pins.map((candidate) => candidate.pinId),
})

const pin1Detour = createTrace({
  mspPairId: "U1.1-J1.1",
  pins: [pin("U1", "U1.1"), pin("J1", "J1.1")],
  tracePath: [
    { x: -0.5, y: 0.5 },
    { x: -0.7, y: 0.5 },
    { x: -0.7, y: 0.9 },
    { x: -1.3, y: 0.9 },
    { x: -1.3, y: 0.5 },
    { x: -1.5, y: 0.5 },
  ],
})

const pin6Branch = createTrace({
  mspPairId: "U1.6-J1.1",
  pins: [pin("U1", "U1.6"), pin("J1", "J1.1")],
  tracePath: [
    { x: -0.5, y: 0 },
    { x: -1.3, y: 0 },
    { x: -1.3, y: 0.5 },
    { x: -1.5, y: 0.5 },
  ],
})

const vccLabel: NetLabelPlacement = {
  globalConnNetId: "vcc-net",
  dcConnNetId: "vcc-net",
  netId: "VCC",
  mspConnectionPairIds: [pin1Detour.mspPairId, pin6Branch.mspPairId],
  pinIds: ["J1.1", "U1.1", "U1.6"],
  orientation: "y+",
  anchorPoint: { x: -1.3, y: 0.5 },
  center: { x: -1.3, y: 0.74 },
  width: 0.42,
  height: 0.48,
}

const createSolver = (traces: SolvedTracePath[]) =>
  new TraceCleanupSolver({
    inputProblem,
    allTraces: traces,
    allLabelPlacements: [vccLabel],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
    operations: ["minimizing_turns"],
  })

test("VCC pin 1 routes directly left through its same-net branch", () => {
  const solver = createSolver([pin1Detour, pin6Branch])

  solver.solve()

  const pin1Trace = solver
    .getOutput()
    .traces.find((trace) => trace.mspPairId === pin1Detour.mspPairId)!
  expect(pin1Trace.tracePath).toEqual([
    { x: -0.5, y: 0.5 },
    { x: -1.5, y: 0.5 },
  ])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("pin 1 keeps the detour when the blocking branch is another net", () => {
  const signalBranch = {
    ...pin6Branch,
    mspPairId: "signal-branch",
    dcConnNetId: "signal-net",
    globalConnNetId: "signal-net",
    userNetId: "SIGNAL",
  }
  const solver = createSolver([pin1Detour, signalBranch])

  solver.solve()

  const pin1Trace = solver
    .getOutput()
    .traces.find((trace) => trace.mspPairId === pin1Detour.mspPairId)!
  expect(pin1Trace.tracePath).toEqual(pin1Detour.tracePath)
})
