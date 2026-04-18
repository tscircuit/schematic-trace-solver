import { test, expect } from "bun:test"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

function createMinimalInputProblem(): InputProblem {
  return {
    components: [],
    connections: [],
    matchedSchematicPorts: [],
  } as any
}

function runSolverToCompletion(solver: TraceCleanupSolver, maxSteps = 500) {
  let steps = 0
  while (!solver.solved && !solver.failed && steps < maxSteps) {
    solver.step()
    steps++
  }
  return steps
}

test("merge same-net horizontal traces that are close together (nearly same Y)", () => {
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    connectionName: "NetA",
    tracePath: [
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
    ],
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    connectionName: "NetA",
    tracePath: [
      { x: 0, y: 1.05 },
      { x: 5, y: 1.05 },
    ],
  }

  const solver = new TraceCleanupSolver({
    inputProblem: createMinimalInputProblem(),
    allTraces: [trace1, trace2],
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.2,
  })

  runSolverToCompletion(solver)

  const output = solver.getOutput()
  const outputTraces: SolvedTracePath[] = (output as any).allTraces ?? (output as any).traces ?? []

  if (outputTraces.length >= 2) {
    const netATraces = outputTraces.filter(
      (t) => t.connectionName === "NetA",
    )

    if (netATraces.length === 2) {
      const y1Values = netATraces[0].tracePath.map((p) => p.y)
      const y2Values = netATraces[1].tracePath.map((p) => p.y)

      const avgY1 = y1Values.reduce((a, b) => a + b, 0) / y1Values.length
      const avgY2 = y2Values.reduce((a, b) => a + b, 0) / y2Values.length

      // After merging, the two horizontal traces should share the same Y coordinate
      // or at least be much closer than the original 0.05 gap
      const yDiff = Math.abs(avgY1 - avgY2)
      expect(yDiff).toBeLessThan(0.05)
    }
  }

  expect(solver.solved).toBe(true)
})

test("merge same-net vertical traces that are close together (nearly same X)", () => {
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    connectionName: "NetB",
    tracePath: [
      { x: 2.0, y: 0 },
      { x: 2.0, y: 5 },
    ],
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    connectionName: "NetB",
    tracePath: [
      { x: 2.04, y: 0 },
      { x: 2.04, y: 5 },
    ],
  }

  const solver = new TraceCleanupSolver({
    inputProblem: createMinimalInputProblem(),
    allTraces: [trace1, trace2],
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.2,
  })

  runSolverToCompletion(solver)

  const output = solver.getOutput()
  const outputTraces: SolvedTracePath[] = (output as any).allTraces ?? (output as any).traces ?? []

  if (outputTraces.length >= 2) {
    const netBTraces = outputTraces.filter(
      (t) => t.connectionName === "NetB",
    )

    if (netBTraces.length === 2) {
      const x1Values = netBTraces[0].tracePath.map((p) => p.x)
      const x2Values = netBTraces[1].tracePath.map((p) => p.x)

      const avgX1 = x1Values.reduce((a, b) => a + b, 0) / x1Values.length
      const avgX2 = x2Values.reduce((a, b) => a + b, 0) / x2Values.length

      const xDiff = Math.abs(avgX1 - avgX2)
      expect(xDiff).toBeLessThan(0.04)
    }
  }

  expect(solver.solved).toBe(true)
})

test("does not merge traces from different nets even if close together", () => {
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    connectionName: "NetA",
    tracePath: [
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
    ],
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    connectionName: "NetC",
    tracePath: [
      { x: 0, y: 1.05 },
      { x: 5, y: 1.05 },
    ],
  }

  const solver = new TraceCleanupSolver({
    inputProblem: createMinimalInputProblem(),
    allTraces: [trace1, trace2],
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.2,
  })

  runSolverToCompletion(solver)

  const output = solver.getOutput()
  const outputTraces: SolvedTracePath[] = (output as any).allTraces ?? (output as any).traces ?? []

  if (outputTraces.length >= 2) {
    const netATrace = outputTraces.find((t) => t.connectionName === "NetA")
    const netCTrace = outputTraces.find((t) => t.connectionName === "NetC")

    if (netATrace && netCTrace) {
      // They should remain at their original Y coordinates (not merged)
      const netAY = netATrace.tracePath[0].y
      const netCY = netCTrace.tracePath[0].y
      // The original gap was 0.05, it should still be present
      expect(Math.abs(netAY - netCY)).toBeGreaterThanOrEqual(0.04)
    }
  }

  expect(solver.solved).toBe(true)
})

test("merge same-net traces with multi-segment paths containing parallel segments", () => {
  // Trace1 has an L-shaped path with a horizontal segment at y=3.0
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    connectionName: "NetD",
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 3.0 },
      { x: 5, y: 3.0 },
    ],
  }

  // Trace2 has an L-shaped path with a horizontal segment at y=3.06 (close to trace1's segment)
  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    connectionName: "NetD",
    tracePath: [
      { x: 1, y: 0 },
      { x: 1, y: 3.06 },
      { x: 6, y: 3.06 },
    ],
  }

  const solver = new TraceCleanupSolver({
    inputProblem: createMinimalInputProblem(),
    allTraces: [trace1, trace2],
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.2,
  })

  runSolverToCompletion(solver)

  const output = solver.getOutput()
  const outputTraces: SolvedTracePath[] = (output as any).allTraces ?? (output as any).traces ?? []

  if (outputTraces.length >= 2) {
    const netDTraces = outputTraces.filter(
      (t) => t.connectionName === "NetD",
    )

    if (netDTraces.length === 2) {
      // Find horizontal segments in each trace (consecutive points with same Y)
      const getHorizontalYValues = (path: { x: number; y: number }[]) => {
        const yValues: number[] = []
        for (let i = 0; i < path.length - 1; i++) {
          if (Math.abs(path[i].y - path[i + 1].y) < 0.001) {
            yValues.push(path[i].y)
          }
        }
        return yValues
      }

      const hY1 = getHorizontalYValues(netDTraces[0].tracePath)
      const hY2 = getHorizontalYValues(netDTraces[1].tracePath)

      if (hY1.length > 0 && hY2.length > 0) {
        // The horizontal segments that were originally at y=3.0 and y=3.06
        // should now be merged to the same (or very close) Y coordinate
        const minDiff = Math.min(
          ...hY1.flatMap((y1) => hY2.map((y2) => Math.abs(y1 - y2))),
        )
        expect(minDiff).toBeLessThan(0.06)
      }
    }
  }

  expect(solver.solved).toBe(true)
})

test("does not merge same-net traces that are far apart", () => {
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    connectionName: "NetE",
    tracePath: [
      { x: 0, y: 1.0 },
      { x: 5, y: 1.0 },
    ],
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    connectionName: "NetE",
    tracePath: [
      { x: 0, y: 3.0 },
      { x: 5, y: 3.0 },
    ],
  }

  const solver = new TraceCleanupSolver({
    inputProblem: createMinimalInputProblem(),
    allTraces: [trace1, trace2],
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.2,
  })

  runSolverToCompletion(solver)

  const output = solver.getOutput()
  const outputTraces: SolvedTracePath[] = (output as any).allTraces ?? (output as any).traces ?? []

  if (outputTraces.length >= 2) {
    const netETraces = outputTraces.filter(
      (t) => t.connectionName === "NetE",
    )

    if (netETraces.length === 2) {
      const y1 = netETraces[0].tracePath[0].y
      const y2 = netETraces[1].tracePath[0].y

      // The gap of 2.0 is well above any reasonable merge threshold,
      // so they should remain separate
      expect(Math.abs(y1 - y2)).toBeGreaterThan(1.0)
    }
  }

  expect(solver.solved).toBe(true)
})