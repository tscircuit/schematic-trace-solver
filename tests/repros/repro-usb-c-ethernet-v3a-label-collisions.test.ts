import { expect, test } from "bun:test"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import { getSolverSnapshotSvg } from "tests/fixtures/matcher"
import inputJson from "./assets/repro-usb-c-ethernet-v3a-label-collisions.input.json"

// Complete 43-component USB-C Ethernet capture introduced in #1270.
// The input is a byte-for-byte copy of usb-c-ethernet-schematic.input.json.
// #1279 preserves the supply junction; this repro pins the separate collision
// between that V3A branch and three unrelated labels beside U1.
test("repro USB-C Ethernet V3A branch passes through VPHYPLL, USB_DM and USB_DP labels", async () => {
  const input = structuredClone(inputJson) as unknown as InputProblem
  const original = structuredClone(input)
  const solver = new SchematicTracePipelineSolver(input, { hideRatsNet: true })
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(input).toEqual(original)

  const output = solver.netLabelToTraceSolver!.getOutput()
  const supplyBranch = output.traces.find(
    (trace) =>
      trace.userNetId === "V3A" &&
      trace.pinIds.includes("schematic_port_41") &&
      trace.pinIds.includes("schematic_port_35"),
  )
  const supplyRail = output.traces.find((trace) =>
    trace.pinIds.includes("schematic_port_30"),
  )
  expect(supplyBranch).toBeDefined()
  expect(supplyRail).toBeDefined()
  expect(
    tracePathContainsPoint(
      supplyRail!.tracePath,
      supplyBranch!.tracePath.at(-1)!,
    ),
  ).toBe(true)

  const targets = [
    { netId: "VPHYPLL", pinId: "schematic_port_36" },
    { netId: "USB_DM", pinId: "schematic_port_37" },
    { netId: "USB_DP", pinId: "schematic_port_38" },
  ]
  for (const { netId, pinId } of targets) {
    const label = output.netLabelPlacements.find(
      (label) => label.netId === netId && label.pinIds.includes(pinId),
    )
    expect(label).toBeDefined()
    expect(label!.globalConnNetId).not.toBe(supplyBranch!.globalConnNetId)
    const bounds = getAnchoredNetLabelRenderedBounds(label!)

    // Pin the current bug in final solver geometry, independently of the SVG.
    // A fix should change this assertion to false and update the snapshot.
    expect(
      supplyBranch!.tracePath
        .slice(1)
        .some((end, index) =>
          segmentIntersectsRect(supplyBranch!.tracePath[index]!, end, bounds),
        ),
    ).toBe(true)
  }

  const circuitJson = convertSolverOutputToCircuitJson(solver)
  const namesBySourceNetId = new Map(
    circuitJson
      .filter((element) => element.type === "source_net")
      .map((element) => [element.source_net_id, element.name]),
  )
  const targetNetNames = new Set(targets.map(({ netId }) => netId))
  // The capture omits netLabelText. Restore these known net names only in the
  // rendered snapshot instead of showing the helper's X placeholders. Routing
  // input, trace paths and label placements are not modified.
  for (const element of circuitJson) {
    if (element.type !== "schematic_net_label") continue
    const name = namesBySourceNetId.get(element.source_net_id)
    if (name && targetNetNames.has(name)) element.text = name
  }
  await expect(
    getSolverSnapshotSvg({ solver, circuitJson }),
  ).toMatchSvgSnapshot(import.meta.path)
})
