import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import inputProblem from "./bug-report-20260806T093501Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260806T093501Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const vmRailTrace = solver
    .sameNetJunctionAlignmentSolver!.getOutput()
    .traces.find(
      (trace) => trace.mspPairId === "schematic_port_41-schematic_port_48",
    )
  expect(vmRailTrace).toBeDefined()
  const labels =
    solver.sameNetJunctionAlignmentSolver!.getOutput().netLabelPlacements
  for (const pinId of ["schematic_port_41", "schematic_port_48"]) {
    const label = labels.find((label) => label.pinIds.includes(pinId))!
    expect(label.netId).toBe("VM")
    expect(label.orientation).toBe("y+")
  }
  expect(
    solver
      .sameNetJunctionAlignmentSolver!.getOutput()
      .traces.some(
        (trace) =>
          trace.pinIds.includes("schematic_port_25") &&
          trace.pinIds.includes("schematic_port_42"),
      ),
  ).toBe(false)
  for (const pinId of ["schematic_port_25", "schematic_port_42"]) {
    expect(labels.find((label) => label.pinIds.includes(pinId))?.netId).toBe(
      "GND",
    )
  }

  const finalOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  expect(
    detectTraceLabelOverlap({
      traces: finalOutput.traces,
      netLabels: finalOutput.netLabelPlacements,
    }).map(({ trace, label }) => `${trace.mspPairId}->${label.netId}`),
  ).toEqual([])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
