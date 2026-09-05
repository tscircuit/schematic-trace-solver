import { expect, test } from "bun:test"
import {
  countPathIntersections,
  getPathLength,
} from "lib/solvers/Example28Solver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { findFirstCollision } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "tests/bug-reports/bug-report-20260905T041712Z/bug-report-20260905T041712Z.json"

test.each(["chip", "text", "trace"] as const)(
  "rejects a local recovery elbow blocked by a %s",
  (obstacleKind) => {
    const pipeline = new SchematicTracePipelineSolver(
      structuredClone(inputProblem) as InputProblem,
    )
    pipeline.solveUntilPhase("unroutedTraceRecoverySolver")

    const connectionPair =
      pipeline.schematicTraceLinesSolver!.failedConnectionPairs.find(
        (pair) => pair.mspPairId === "schematic_port_101-schematic_port_125",
      )!
    const problem = pipeline.inputProblem
    const existingTraces = [
      ...pipeline.longDistancePairSolver!.getOutput().allTracesMerged,
    ]
    const blockingBounds = { minX: 3.6, maxX: 3.7, minY: -8.96, maxY: -8.94 }
    const blockingPath = [
      { x: 3.6, y: -8.95 },
      { x: 3.7, y: -8.95 },
    ]

    if (obstacleKind === "chip") {
      problem.chips.push({
        chipId: "blocking-chip",
        center: { x: 3.65, y: -8.95 },
        width: 0.1,
        height: 0.02,
        pins: [],
      })
    }
    if (obstacleKind === "text") {
      problem.textBoxes!.push({
        center: { x: 3.65, y: -8.95 },
        width: 0.1,
        height: 0.02,
      })
    }
    if (obstacleKind === "trace") {
      const otherNetTrace = existingTraces.find(
        (trace) => trace.globalConnNetId !== connectionPair.globalConnNetId,
      )!
      existingTraces.splice(existingTraces.indexOf(otherNetTrace), 1, {
        ...otherNetTrace,
        tracePath: blockingPath,
      })
    }

    const recovery = new UnroutedTraceRecoverySolver({
      inputProblem: problem,
      failedConnectionPairs: [connectionPair],
      alreadySolvedTraces: existingTraces,
    })
    recovery.solve()

    expect(recovery.solved).toBe(true)
    expect(recovery.solvedUnroutedTraces).toHaveLength(1)
    const recoveredPath = recovery.solvedUnroutedTraces[0]!.tracePath
    expect(getPathLength(recoveredPath)).toBeGreaterThan(0.8)
    expect(findFirstCollision(recoveredPath, [blockingBounds])).toBeNull()
    expect(countPathIntersections(recoveredPath, blockingPath)).toBe(0)
  },
)
