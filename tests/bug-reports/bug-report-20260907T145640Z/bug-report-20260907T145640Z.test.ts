import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { doSegmentsIntersect } from "@tscircuit/math-utils/line-intersections"
import { expect, test } from "bun:test"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import inputProblem from "./bug-report-20260907T145640Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260907T145640Z", async () => {
  const original = structuredClone(inputProblem)
  const solver = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  // This is the output consumed by core, before NetLabelToTraceSolver renders
  // diagnostic terminal wires.
  const output = solver.inlineNetLabelSolver!.getOutput()
  // Audit the entire report, including U3, rather than selected screenshots.
  expect([...getOutputLabelCollisions(output)]).toEqual([])
  for (const connection of inputProblem.netConnections.filter(
    (connection) => connection.allowInlineNetLabel,
  )) {
    expect(
      output.netLabelPlacements.filter(
        (label) => label.netId === connection.netId,
      ),
    ).toEqual([])
    for (const pinId of connection.pinIds)
      expect(
        output.inlineNetLabelPlacements.filter(
          (label) =>
            label.netId === connection.netId && label.pinIds.includes(pinId),
        ),
      ).toHaveLength(1)
  }
  // Remote routes must clear entire terminal wires, including their tails
  // beyond the text and terminals on the same net (the U3 SCL regression).
  const terminalWireCrossings = output.inlineNetLabelPlacements.flatMap(
    (label) => {
      if (!label.stubTracePath) return []
      const [start, end] = label.stubTracePath
      return output.traces
        .filter(
          (trace) =>
            !trace.pinIds.some((pinId) => label.pinIds.includes(pinId)) &&
            trace.tracePath
              .slice(1)
              .some((point, index) =>
                doSegmentsIntersect(
                  start!,
                  end!,
                  trace.tracePath[index]!,
                  point,
                ),
              ),
        )
        .map((trace) => ({ terminal: label.pinIds, trace: trace.mspPairId }))
    },
  )
  expect(terminalWireCrossings).toEqual([])
  // U2 pin 17 must remain connected and clear of the final signal labels.
  const traceId = "schematic_port_57-schematic_port_86"
  const clearedTrace = solver
    .traceLabelOverlapAvoidanceSolver!.getOutput()
    .traces.find((trace) => trace.mspPairId === traceId)!
  const finalTrace = output.traces.find((trace) => trace.mspPairId === traceId)!
  expect(finalTrace).toBeDefined()
  expect(finalTrace.tracePath).toHaveLength(4)
  const beforeInline = new Map(
    solver
      .inlineNetLabelSolver!.getConstructorParams()[0]
      .traces.map((trace) => [trace.mspPairId, trace]),
  )
  for (const trace of output.traces) {
    const before = beforeInline.get(trace.mspPairId)
    if (before)
      expect(simplifyPath(trace.tracePath).length).toBeLessThanOrEqual(
        simplifyPath(before.tracePath).length,
      )
  }
  expect(finalTrace.tracePath[0]).toEqual(clearedTrace.tracePath[0])
  expect(finalTrace.tracePath.at(-1)).toEqual(clearedTrace.tracePath.at(-1))
  for (const label of output.netLabelPlacements) {
    if (label.globalConnNetId === finalTrace.globalConnNetId) continue
    const bounds = getAnchoredNetLabelRenderedBounds(label)
    expect(
      finalTrace.tracePath
        .slice(1)
        .some((end, index) =>
          segmentIntersectsRect(finalTrace.tracePath[index]!, end, bounds),
        ),
    ).toBe(false)
  }
  // Power labels in the supplied input are not opted in. Preserve them rather
  // than overriding the caller's policy to make every label appear inline.
  for (const netId of [
    "PMID",
    "OLED_3V",
    "V3",
    "PACK_P",
    "GAUGE_VDD",
    "BAT_SYS",
  ]) {
    expect(
      output.netLabelPlacements.some((label) => label.netId === netId),
    ).toBe(true)
    expect(
      output.inlineNetLabelPlacements.some((label) => label.netId === netId),
    ).toBe(false)
  }
  expect(inputProblem).toEqual(original)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
