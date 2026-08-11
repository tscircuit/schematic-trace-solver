import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260811T075142Z.json"
import "tests/fixtures/matcher"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import {
  rectsOverlap,
  traceCrossesBoundsInterior,
} from "lib/solvers/AvailableNetOrientationSolver/geometry"

test("bug-report-20260811T075142Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const usbPlusLabel = output.netLabelPlacements.find(
    (label) => label.netId === "USB_D_PLUS",
  )
  const gndLabel = output.netLabelPlacements.find(
    (label) => label.netId === "GND",
  )
  const upwardPowerLabels = ["V3_3", "VBUS_5V", "VBAT"].map(
    (netId) =>
      output.netLabelPlacements.find((label) => label.netId === netId)!,
  )

  expect(usbPlusLabel).toBeDefined()
  expect(["x-", "x+"]).toContain(usbPlusLabel!.orientation)
  expect(upwardPowerLabels.map((label) => label.orientation)).toEqual([
    "y+",
    "y+",
    "y+",
  ])
  expect(upwardPowerLabels[1]!.anchorPoint.y).toBeGreaterThan(
    upwardPowerLabels[0]!.anchorPoint.y,
  )
  expect(upwardPowerLabels[2]!.anchorPoint.y).toBeGreaterThan(
    upwardPowerLabels[1]!.anchorPoint.y,
  )
  expect(gndLabel?.orientation).toBe("y-")
  expect(gndLabel!.anchorPoint.y).toBe(upwardPowerLabels[1]!.center.y)
  expect(gndLabel!.center.y).toBeGreaterThan(upwardPowerLabels[0]!.center.y)
  expect(gndLabel!.center.y).toBeLessThan(upwardPowerLabels[2]!.center.y)

  for (const netId of ["V3_3", "VBUS_5V", "VBAT", "GND"]) {
    const connector = output.traces.find(
      (trace) =>
        trace.userNetId === netId &&
        trace.mspPairId.startsWith("available-net-orientation-"),
    )
    expect(connector).toBeDefined()
    expect(connector!.tracePath).toHaveLength(3)
    const [pin, bend, labelAnchor] = connector!.tracePath
    expect(bend!.x).toBe(pin!.x)
    expect(bend!.y).toBeGreaterThan(pin!.y)
    expect(labelAnchor!.y).toBe(bend!.y)
  }

  const gndConnector = output.traces.find(
    (trace) =>
      trace.userNetId === "GND" &&
      trace.mspPairId.startsWith("available-net-orientation-"),
  )!
  expect(gndConnector.tracePath[2]!.x).toBeGreaterThan(
    gndConnector.tracePath[1]!.x,
  )

  const overlappingLabelPairs: string[] = []
  for (let i = 0; i < output.netLabelPlacements.length; i++) {
    for (let j = i + 1; j < output.netLabelPlacements.length; j++) {
      const a = output.netLabelPlacements[i]!
      const b = output.netLabelPlacements[j]!
      if (
        rectsOverlap(
          getRectBounds(a.center, a.width, a.height),
          getRectBounds(b.center, b.width, b.height),
        )
      ) {
        overlappingLabelPairs.push(`${a.netId}::${b.netId}`)
      }
    }
  }
  expect(overlappingLabelPairs).toEqual([])

  const traceLabelIntersections: string[] = []
  for (const label of output.netLabelPlacements) {
    const bounds = getRectBounds(label.center, label.width, label.height)
    for (const trace of output.traces) {
      if (trace.globalConnNetId === label.globalConnNetId) continue
      if (
        traceCrossesBoundsInterior(bounds, {
          [trace.mspPairId]: trace,
        })
      ) {
        traceLabelIntersections.push(`${trace.userNetId}::${label.netId}`)
      }
    }
  }
  expect(traceLabelIntersections).toEqual([])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("dense top fanout is independent of net connection input order", () => {
  const reorderedInput = structuredClone(inputProblem)
  reorderedInput.netConnections.reverse()
  const solver = new SchematicTracePipelineSolver(reorderedInput as any)

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const verticalNetIds = ["V3_3", "VBUS_5V", "VBAT", "GND"]
  for (const netId of verticalNetIds) {
    const connector = output.traces.find(
      (trace) =>
        trace.userNetId === netId &&
        trace.mspPairId.startsWith("available-net-orientation-"),
    )
    expect(connector).toBeDefined()
    const [pin, bend, labelAnchor] = connector!.tracePath
    expect(bend!.x).toBe(pin!.x)
    expect(bend!.y).toBeGreaterThan(pin!.y)
    expect(labelAnchor!.y).toBe(bend!.y)
  }

  expect(
    output.netLabelPlacements.find((label) => label.netId === "GND")
      ?.orientation,
  ).toBe("y-")
})
