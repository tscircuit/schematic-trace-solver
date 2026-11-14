import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260825T045913Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260825T045913Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const u1SwGlobalNetId =
    solver.mspConnectionPairSolver!.globalConnMap.getNetConnectedToId("U1_SW")
  const u1SwTraceMinY = Math.min(
    ...solver
      .schematicTraceLinesSolver!.solvedTracePaths.filter(
        (trace) => trace.globalConnNetId === u1SwGlobalNetId,
      )
      .flatMap((trace) => trace.tracePath.map((point) => point.y)),
  )
  expect(u1SwTraceMinY).toBe(1.1)
  const alignedSharedPinBranch =
    solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
      (trace) => trace.mspPairId === "schematic_port_29-schematic_port_21",
    )!
  expect(alignedSharedPinBranch.tracePath[0]!.x).toBeCloseTo(
    alignedSharedPinBranch.tracePath[1]!.x,
  )

  const pgndGlobalNetId =
    solver.mspConnectionPairSolver!.globalConnMap.getNetConnectedToId("PGND")
  const finalOutput = solver.netLabelToTraceSolver!.getOutput()
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

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
