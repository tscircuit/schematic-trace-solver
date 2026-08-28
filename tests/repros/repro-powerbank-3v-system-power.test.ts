import { expect, test } from "bun:test"
import { doSegmentsIntersect } from "@tscircuit/math-utils"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE } from "lib/utils/doesPathCoincideWithTraces"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-powerbank-3v-system-power.input.json"

const crossesNonEndpointTrace = (
  recoveredTrace: SolvedTracePath,
  traces: SolvedTracePath[],
) =>
  traces.some(
    (otherTrace) =>
      otherTrace !== recoveredTrace &&
      !otherTrace.pinIds.some((pinId) =>
        recoveredTrace.pinIds.includes(pinId),
      ) &&
      recoveredTrace.tracePath
        .slice(1)
        .some((pathEnd, pathIndex) =>
          otherTrace.tracePath
            .slice(1)
            .some((traceEnd, traceIndex) =>
              doSegmentsIntersect(
                recoveredTrace.tracePath[pathIndex]!,
                pathEnd,
                otherTrace.tracePath[traceIndex]!,
                traceEnd,
              ),
            ),
        ),
  )

const hasInsufficientParallelClearance = (
  firstTrace: SolvedTracePath,
  secondTrace: SolvedTracePath,
) => {
  const epsilon = 1e-6
  for (
    let firstIndex = 0;
    firstIndex < firstTrace.tracePath.length - 1;
    firstIndex++
  ) {
    const firstStart = firstTrace.tracePath[firstIndex]!
    const firstEnd = firstTrace.tracePath[firstIndex + 1]!
    const firstIsVertical = Math.abs(firstStart.x - firstEnd.x) < epsilon
    const firstIsHorizontal = Math.abs(firstStart.y - firstEnd.y) < epsilon
    if (!firstIsVertical && !firstIsHorizontal) continue

    for (
      let secondIndex = 0;
      secondIndex < secondTrace.tracePath.length - 1;
      secondIndex++
    ) {
      const secondStart = secondTrace.tracePath[secondIndex]!
      const secondEnd = secondTrace.tracePath[secondIndex + 1]!
      const secondIsParallel = firstIsVertical
        ? Math.abs(secondStart.x - secondEnd.x) < epsilon
        : Math.abs(secondStart.y - secondEnd.y) < epsilon
      if (!secondIsParallel) continue

      const crossAxisSeparation = firstIsVertical
        ? Math.abs(firstStart.x - secondStart.x)
        : Math.abs(firstStart.y - secondStart.y)
      const overlap = firstIsVertical
        ? Math.min(
            Math.max(firstStart.y, firstEnd.y),
            Math.max(secondStart.y, secondEnd.y),
          ) -
          Math.max(
            Math.min(firstStart.y, firstEnd.y),
            Math.min(secondStart.y, secondEnd.y),
          )
        : Math.min(
            Math.max(firstStart.x, firstEnd.x),
            Math.max(secondStart.x, secondEnd.x),
          ) -
          Math.max(
            Math.min(firstStart.x, firstEnd.x),
            Math.min(secondStart.x, secondEnd.x),
          )
      if (
        crossAxisSeparation + epsilon <
          SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE &&
        overlap > epsilon
      ) {
        return true
      }
    }
  }
  return false
}

// Exact solver input captured from the "3 V System Power" sheet in the
// PowerBank example circuit from @tsci/tscircuit.ti.
test("repro PowerBank 3 V System Power schematic", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const { netConnMap } = getConnectivityMapsFromInputProblem(
    solver.inputProblem,
  )
  const groundGlobalConnNetId = netConnMap.getNetConnectedToId("GND")!
  const groundPinIds = solver.inputProblem.chips
    .flatMap((chip) => chip.pins.map((pin) => pin.pinId))
    .filter(
      (pinId) =>
        netConnMap.getNetConnectedToId(pinId) === groundGlobalConnNetId,
    )
  const groundComponents = getTraceConnectedPinComponents({
    pinIds: groundPinIds,
    traces: output.traces.filter(
      (trace) => trace.globalConnNetId === groundGlobalConnNetId,
    ),
  })
  const groundRecoveredTraces = output.traces.filter(
    (trace) =>
      trace.globalConnNetId === groundGlobalConnNetId &&
      trace.mspPairId.startsWith("net-label-to-trace-"),
  )
  const recoveredTraceCrossesNonEndpointTrace = groundRecoveredTraces.some(
    (recoveredTrace) => crossesNonEndpointTrace(recoveredTrace, output.traces),
  )
  const recoveredTraceHasInsufficientClearance = groundRecoveredTraces.some(
    (recoveredTrace) =>
      output.traces.some(
        (otherTrace) =>
          otherTrace !== recoveredTrace &&
          !otherTrace.pinIds.some((pinId) =>
            recoveredTrace.pinIds.includes(pinId),
          ) &&
          hasInsufficientParallelClearance(recoveredTrace, otherTrace),
      ),
  )
  const u1Pin4GlobalConnNetId =
    netConnMap.getNetConnectedToId("schematic_port_396")!
  const u1Pin4PinIds = solver.inputProblem.chips
    .flatMap((chip) => chip.pins.map((pin) => pin.pinId))
    .filter(
      (pinId) =>
        netConnMap.getNetConnectedToId(pinId) === u1Pin4GlobalConnNetId,
    )
  const u1Pin4Components = getTraceConnectedPinComponents({
    pinIds: u1Pin4PinIds,
    traces: output.traces.filter(
      (trace) => trace.globalConnNetId === u1Pin4GlobalConnNetId,
    ),
  })
  const u1Pin4RecoveredTrace = output.traces.find(
    (trace) =>
      trace.mspPairId.startsWith("net-label-to-trace-") &&
      trace.pinIds.includes("schematic_port_396"),
  )

  expect(groundComponents).toHaveLength(1)
  expect(recoveredTraceCrossesNonEndpointTrace).toBe(false)
  expect(recoveredTraceHasInsufficientClearance).toBe(false)
  expect(u1Pin4Components).toHaveLength(1)
  expect(u1Pin4RecoveredTrace).toBeDefined()
  expect(crossesNonEndpointTrace(u1Pin4RecoveredTrace!, output.traces)).toBe(
    false,
  )
  expect(
    output.netLabelPlacements.filter(
      (label) => label.globalConnNetId === u1Pin4GlobalConnNetId,
    ),
  ).toHaveLength(0)
  expect(
    output.netLabelPlacements.filter(
      (label) => label.globalConnNetId === groundGlobalConnNetId,
    ),
  ).toHaveLength(1)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
