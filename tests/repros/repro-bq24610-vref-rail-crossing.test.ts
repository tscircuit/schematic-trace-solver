import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { findPerpendicularPathCrossings } from "lib/solvers/TraceCleanupSolver/sub-solver/findIntersectionsWithObstacles"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import inputProblem from "./assets/repro-bq24610-vref-rail-crossing.input.json"

// Reduced from Core's solver:started capture of the BQ24610 charger extract.
// Keep U2's complete pin geometry and the VCC_CHG / VREF nets. See the adjacent
// asset README for provenance and the reduction. No manual netlabel is involved.
test("repro BQ24610 automatic VREF rail crossing three supply wires", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const vref = netLabelPlacements.find((label) => label.netId === "VREF")!
  const vcc = netLabelPlacements.find((label) => label.netId === "VCC_CHG")!
  expect(vref).toBeDefined()
  expect(vcc).toBeDefined()
  expect(vref.orientation).toBe("y+")
  expect(vref.globalConnNetId).not.toBe(vcc.globalConnNetId)

  const vrefTraces = traces.filter(
    (trace) => trace.globalConnNetId === vref.globalConnNetId,
  )
  const vccTraces = traces.filter(
    (trace) => trace.globalConnNetId === vcc.globalConnNetId,
  )
  const crossings = vrefTraces.flatMap((trace) =>
    vccTraces.flatMap((other) =>
      findPerpendicularPathCrossings(trace.tracePath, other.tracePath, {
        includeTerminalSegments: true,
      }),
    ),
  )

  // Known bad behavior: the automatic rail extends above VCC, crossing the
  // unrelated VCC/ACP/ACN pin exits. A fix should make this zero and update the
  // snapshot while preserving the upward rail and both nets' pin connections.
  expect(crossings).toHaveLength(3)
  const vccPin = inputProblem.chips[0]!.pins.find(
    (pin) => pin.displayName === "VCC",
  )!
  expect(vref.anchorPoint.y).toBeGreaterThan(vccPin.y)

  // Core renders these two nets as rail_up. Restore only that presentation
  // metadata after solving; the captured input, wire paths and label anchors
  // are untouched. Hide routing text-box outlines in this focused schematic.
  const circuitJson = convertSolverOutputToCircuitJson(solver)
  const netNames = new Map(
    circuitJson
      .filter((element) => element.type === "source_net")
      .map((net) => [net.source_net_id, net.name]),
  )
  const schematic = circuitJson
    .filter((element) => element.type !== "schematic_box")
    .map((element) => {
      if (element.type === "schematic_net_label") {
        return {
          ...element,
          text: netNames.get(element.source_net_id)!,
          symbol_name: "rail_up",
        }
      }
      if (element.type === "schematic_text") {
        return { ...element, color: "#006464" }
      }
      return element
    })
  await expect(
    convertCircuitJsonToSchematicSvg(schematic, {
      width: 1000,
      height: 900,
      colorOverrides: { schematic: { background: "#ffffff" } },
    }).replace(/[ \t]+$/gm, ""),
  ).toMatchSvgSnapshot(import.meta.path)
})
