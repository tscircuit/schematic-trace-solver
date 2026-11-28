import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import type { InputProblem } from "lib/types/InputProblem"
import bugReport873 from "tests/bug-reports/bug-report-20260825T045913Z/bug-report-20260825T045913Z.json"

test("records joined host component pins when junction recovery lands on a disconnected same-net island", () => {
  const pinL1 = {
    pinId: "L1",
    x: -2.5,
    y: -0.2,
    _facingDirection: "y-" as const,
  }
  const pinL2 = {
    pinId: "L2",
    x: -1.5,
    y: -0.2,
    _facingDirection: "y-" as const,
  }
  const pinR1 = {
    pinId: "R1",
    x: 0.6,
    y: -0.2,
    _facingDirection: "y-" as const,
  }
  const pinR2 = {
    pinId: "R2",
    x: 1.4,
    y: -0.2,
    _facingDirection: "y-" as const,
  }
  const pinR3 = {
    pinId: "R3",
    x: 2.2,
    y: -0.2,
    _facingDirection: "y-" as const,
  }

  const problem: InputProblem = {
    chips: [
      {
        chipId: "leftA",
        center: { x: -2.5, y: 0 },
        width: 0.4,
        height: 0.4,
        pins: [pinL1],
      },
      {
        chipId: "leftB",
        center: { x: -1.5, y: 0 },
        width: 0.4,
        height: 0.4,
        pins: [pinL2],
      },
      {
        chipId: "blocker",
        center: { x: -0.4, y: -0.4 },
        width: 0.9,
        height: 1.6,
        pins: [],
      },
      {
        chipId: "rightUnconnected",
        center: { x: 0.6, y: 0 },
        width: 0.4,
        height: 0.4,
        pins: [pinR1],
      },
      {
        chipId: "rightA",
        center: { x: 1.4, y: 0 },
        width: 0.4,
        height: 0.4,
        pins: [pinR2],
      },
      {
        chipId: "rightB",
        center: { x: 2.2, y: 0 },
        width: 0.4,
        height: 0.4,
        pins: [pinR3],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "PGND",
        pinIds: ["L1", "L2", "R1", "R2", "R3"],
      },
    ],
    availableNetLabelOrientations: {
      PGND: ["y-"],
    },
    maxMspPairDistance: 2.5,
  }

  const globalConnNetId =
    getConnectivityMapsFromInputProblem(problem).netConnMap.getNetConnectedToId(
      "PGND",
    ) ?? "PGND"

  const recoverySolver = new UnroutedTraceRecoverySolver({
    inputProblem: problem,
    failedConnectionPairs: [
      {
        mspPairId: "R1-L2",
        dcConnNetId: globalConnNetId,
        globalConnNetId,
        pins: [
          { ...pinR1, chipId: "rightUnconnected" },
          { ...pinL2, chipId: "leftB" },
        ],
      },
    ],
    alreadySolvedTraces: [
      {
        mspPairId: "L1-L2",
        mspConnectionPairIds: ["L1-L2"],
        dcConnNetId: globalConnNetId,
        globalConnNetId,
        pins: [
          { ...pinL1, chipId: "leftA" },
          { ...pinL2, chipId: "leftB" },
        ],
        pinIds: ["L1", "L2"],
        tracePath: [
          { x: -2.5, y: -0.2 },
          { x: -2.5, y: -0.4 },
          { x: -1.5, y: -0.4 },
          { x: -1.5, y: -0.2 },
        ],
      },
      {
        mspPairId: "R2-R3",
        mspConnectionPairIds: ["R2-R3"],
        dcConnNetId: globalConnNetId,
        globalConnNetId,
        pins: [
          { ...pinR2, chipId: "rightA" },
          { ...pinR3, chipId: "rightB" },
        ],
        pinIds: ["R2", "R3"],
        tracePath: [
          { x: 1.4, y: -0.2 },
          { x: 1.4, y: -0.4 },
          { x: 2.2, y: -0.4 },
          { x: 2.2, y: -0.2 },
        ],
      },
    ],
  })
  recoverySolver.solve()

  expect(recoverySolver.solvedUnroutedTraces).toHaveLength(1)
  expect(recoverySolver.solvedUnroutedTraces[0]?.pinIds).toEqual(["R2", "R1"])
  expect(recoverySolver.solvedUnroutedTraces[0]?.pinIds).not.toContain("L2")

  const labelSolver = new NetLabelPlacementSolver({
    inputProblem: problem,
    inputTraceMap: Object.fromEntries(
      recoverySolver
        .getOutput()
        .allTracesMerged.map((trace) => [trace.mspPairId, trace]),
    ),
  })
  labelSolver.solve()
  expect(
    labelSolver.netLabelPlacements.filter((label) => label.netId === "PGND"),
  ).toHaveLength(2)
})

test("connects C5 PGND pin to the output PGND rail while preserving two PGND island labels in bug-report-20260825T045913Z (#873)", () => {
  const problem: InputProblem = JSON.parse(JSON.stringify(bugReport873))
  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()

  const pgndGlobalNetId =
    solver.mspConnectionPairSolver?.globalConnMap.getNetConnectedToId("PGND")
  const finalOutput = solver.netLabelToTraceSolver?.getOutput()
  expect(pgndGlobalNetId).toBeDefined()
  expect(finalOutput).toBeDefined()
  if (!pgndGlobalNetId || !finalOutput) return

  const pgndTraces = finalOutput.traces.filter(
    (trace) => trace.globalConnNetId === pgndGlobalNetId,
  )
  const connectedOutputRailPins = new Set<string>(["schematic_port_45"])
  let previousSize = 0
  while (connectedOutputRailPins.size !== previousSize) {
    previousSize = connectedOutputRailPins.size
    for (const trace of pgndTraces) {
      if (trace.pinIds.some((pinId) => connectedOutputRailPins.has(pinId))) {
        for (const pinId of trace.pinIds) {
          connectedOutputRailPins.add(pinId)
        }
      }
    }
  }
  expect([...connectedOutputRailPins].sort()).toEqual([
    "schematic_port_45",
    "schematic_port_47",
    "schematic_port_49",
    "schematic_port_51",
    "schematic_port_53",
    "schematic_port_55",
  ])

  const pgndLabels = finalOutput.netLabelPlacements.filter(
    (label) => label.netId === "PGND",
  )
  expect(pgndLabels).toHaveLength(2)
})
