import { expect, test } from "bun:test"
import { tracePathsHaveInteriorIntersection } from "lib/solvers/GroundTraceCrossingFilterSolver/getGroundTracesToReplaceWithLabels"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "tests/assets/example02.json"

test("keeps a fallback GND label when orientation correction would cross", () => {
  const solverInput: InputProblem = JSON.parse(JSON.stringify(inputProblem))
  const solver = new SchematicTracePipelineSolver(solverInput)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const groundLabel = output.netLabelPlacements.find(
    (label) => label.netId === "GND" && label.pinIds.includes("U1.2"),
  )!
  const crossingGroundTraces = output.traces.filter((groundTrace) => {
    if (groundTrace.userNetId !== "GND") return false
    return output.traces.some((otherTrace) => {
      if (otherTrace.globalConnNetId === groundTrace.globalConnNetId) {
        return false
      }
      return tracePathsHaveInteriorIntersection({
        firstTracePath: groundTrace.tracePath,
        secondTracePath: otherTrace.tracePath,
      })
    })
  })

  expect(
    solver.groundTraceCrossingFilterSolver!.removedGroundTraces,
  ).toHaveLength(1)
  expect(groundLabel.orientation).toBe("x-")
  expect(crossingGroundTraces).toHaveLength(0)
})
