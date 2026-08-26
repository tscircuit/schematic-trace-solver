import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-cc3235sf-crystal-collapse.input"

const COORDINATE_EPSILON = 1e-6
const MIN_LONG_TRUNK_LENGTH = 1

const getLongVerticalTrunkXs = (tracePath: Array<{ x: number; y: number }>) => {
  const trunkXs: number[] = []
  for (
    let segmentIndex = 1;
    segmentIndex < tracePath.length - 2;
    segmentIndex++
  ) {
    const start = tracePath[segmentIndex]!
    const end = tracePath[segmentIndex + 1]!
    if (Math.abs(start.x - end.x) > COORDINATE_EPSILON) continue
    if (Math.abs(start.y - end.y) < MIN_LONG_TRUNK_LENGTH) continue
    trunkXs.push(start.x)
  }
  return trunkXs
}

// Captured from tscircuit/ti's WirelessMCU_CC3235SF schematic and reduced to
// U2's crystal/GND pins, Y2, and its two load capacitors.
test("repro CC3235SF Y2 crystal traces collapse together", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const traces = solver.sameNetJunctionAlignmentSolver!.getOutput().traces
  const y2ToC28 = traces.find((trace) => trace.pinIds.includes("C28.2"))!
  const c30ToY2 = traces.find(
    (trace) => trace.pinIds.includes("C30.2") && trace.pinIds.includes("Y2.2"),
  )!
  const y2ToC28TrunkXs = getLongVerticalTrunkXs(y2ToC28.tracePath)
  const c30ToY2TrunkXs = getLongVerticalTrunkXs(c30ToY2.tracePath)
  expect(y2ToC28TrunkXs).toHaveLength(1)
  expect(c30ToY2TrunkXs).toHaveLength(1)
  expect(y2ToC28TrunkXs[0]).toBe(c30ToY2TrunkXs[0])
  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.alignedJunctionCount,
  ).toBe(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
