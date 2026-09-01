import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260901T134241Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260901T134241Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const alignedTraces = solver.sameNetJunctionAlignmentSolver!.outputTraces
  for (const [sharedPinId, adjacentPinId, targetPinId] of [
    ["schematic_port_2", "schematic_port_3", "schematic_port_13"],
    ["schematic_port_7", "schematic_port_8", "schematic_port_17"],
  ]) {
    const sharedPin = solver.inputProblem.chips
      .flatMap((chip) => chip.pins)
      .find((pin) => pin.pinId === sharedPinId)!
    const adjacentPin = solver.inputProblem.chips
      .flatMap((chip) => chip.pins)
      .find((pin) => pin.pinId === adjacentPinId)!
    const trace = alignedTraces.find(
      (trace) =>
        trace.pinIds.includes(sharedPinId) &&
        trace.pinIds.includes(targetPinId),
    )!
    const pathFromShared =
      trace.pins[0]!.pinId === sharedPinId
        ? trace.tracePath
        : [...trace.tracePath].reverse()

    expect(pathFromShared[1]!.x).toBeCloseTo(pathFromShared[2]!.x, 6)
    expect(pathFromShared[2]!.y).toBeCloseTo(adjacentPin.y, 6)
    expect(pathFromShared[3]!.y).toBeCloseTo(adjacentPin.y, 6)
    expect(pathFromShared[0]).toEqual({ x: sharedPin.x, y: sharedPin.y })
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
