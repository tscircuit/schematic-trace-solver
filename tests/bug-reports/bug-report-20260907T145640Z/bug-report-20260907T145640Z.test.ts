import { expect, test } from "bun:test"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
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
  const u1Pins = new Set(inputProblem.chips[0]!.pins.map((pin) => pin.pinId))
  for (const connection of inputProblem.netConnections.filter(
    (connection) => connection.allowInlineNetLabel,
  )) {
    const inlinePins = output.inlineNetLabelPlacements
      .filter((label) => label.netId === connection.netId)
      .flatMap((label) => label.pinIds)
    const anchoredPins = output.netLabelPlacements
      .filter((label) => label.netId === connection.netId)
      .flatMap((label) => label.pinIds)
    for (const pinId of connection.pinIds) {
      expect(inlinePins.includes(pinId) || anchoredPins.includes(pinId)).toBe(
        true,
      )
      expect(inlinePins.includes(pinId) && anchoredPins.includes(pinId)).toBe(
        false,
      )
      // A blocked endpoint on another chip must not force U1 to use a tag.
      if (u1Pins.has(pinId)) expect(inlinePins).toContain(pinId)
    }
  }
  for (const label of output.inlineNetLabelPlacements)
    expect(label.side).toBe(label.axis === "x" ? "y+" : "x-")
  for (const pinId of [
    "schematic_port_51",
    "schematic_port_54",
    "schematic_port_55",
  ]) {
    expect(
      output.inlineNetLabelPlacements.some((label) =>
        label.pinIds.includes(pinId),
      ),
    ).toBe(true)
  }
  // The mixed-net obstacle group contains V3 itself. Cleanup must still respect
  // the individual CHG_LP/CHG_IRQ/IMAX labels when simplifying U2 pin 17's wire.
  const traceId = "schematic_port_57-schematic_port_86"
  const clearedTrace = solver
    .traceLabelOverlapAvoidanceSolver!.getOutput()
    .traces.find((trace) => trace.mspPairId === traceId)!
  const finalTrace = output.traces.find((trace) => trace.mspPairId === traceId)!
  expect(finalTrace).toBeDefined()
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
  for (const netId of ["PMID", "OLED_3V", "V3"]) {
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
