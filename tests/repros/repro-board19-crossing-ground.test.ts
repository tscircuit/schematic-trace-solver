import { expect, test } from "bun:test"
import { tracePathsHaveInteriorIntersection } from "lib/solvers/GroundTraceCrossingFilterSolver/getGroundTracesToReplaceWithLabels"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-board19-crossing-ground.input.json"

const REMOVED_GROUND_TRACE_ID = "schematic_port_1-schematic_port_0"

test("replaces a crossing opposite-side GND trace with net labels", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  const filterOutput = solver.groundTraceCrossingFilterSolver!.getOutput()
  const finalOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const inputXinTrace =
    solver.groundTraceCrossingFilterSolver!.inputTraces.find(
      (trace) => trace.userNetId === "XIN",
    )!
  const finalXinTrace = finalOutput.traces.find(
    (trace) => trace.userNetId === "XIN",
  )!
  const groundLabels = finalOutput.netLabelPlacements.filter(
    (label) => label.netId === "GND",
  )
  const finalCrossingGroundTraces = finalOutput.traces.filter((trace) => {
    if (trace.userNetId !== "GND") return false
    return tracePathsHaveInteriorIntersection({
      firstTracePath: trace.tracePath,
      secondTracePath: finalXinTrace.tracePath,
    })
  })

  expect(solver.solved).toBe(true)
  expect(filterOutput.removedGroundTraces).toHaveLength(1)
  expect(filterOutput.removedGroundTraces[0]!.mspPairId).toBe(
    REMOVED_GROUND_TRACE_ID,
  )
  expect(
    tracePathsHaveInteriorIntersection({
      firstTracePath: filterOutput.removedGroundTraces[0]!.tracePath,
      secondTracePath: inputXinTrace.tracePath,
    }),
  ).toBe(true)
  expect(
    finalOutput.traces.some(
      (trace) => trace.mspPairId === REMOVED_GROUND_TRACE_ID,
    ),
  ).toBe(false)
  expect(finalCrossingGroundTraces).toHaveLength(0)
  expect(groundLabels).toHaveLength(2)
  expect(groundLabels.map((label) => label.orientation)).toEqual(["y-", "y-"])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
