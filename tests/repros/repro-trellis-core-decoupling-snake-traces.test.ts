import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTraceConnectedPinComponents } from "lib/solvers/SchematicTraceLinesSolver/getTraceConnectedPinComponents"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "../bug-reports/bug-report-20260907T110144Z/bug-report-20260907T110144Z.json"

test("Trellis decoupling capacitors share straight rails within each row", () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(inputProblem) as unknown as InputProblem,
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const { traces, netLabelPlacements, inlineNetLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const labels = [...netLabelPlacements, ...inlineNetLabelPlacements]
  const netMap = solver.mspConnectionPairSolver!.globalConnMap
  const groundPins = new Set(
    inputProblem.netConnections.find((net) => net.netId === "GND")!.pinIds,
  )
  const capacitors = inputProblem.chips.filter(
    (chip) =>
      chip.pins.length === 2 &&
      chip.pins.every((pin) =>
        inputProblem.netConnections.some((net) =>
          net.pinIds.includes(pin.pinId),
        ),
      ),
  )
  expect(capacitors).toHaveLength(21)

  for (const capacitor of capacitors) {
    for (const pin of capacitor.pins) {
      const netId = netMap.getNetConnectedToId(pin.pinId)!
      const component = getTraceConnectedPinComponents({
        pinIds: inputProblem.chips
          .flatMap((chip) => chip.pins)
          .filter((other) => netMap.getNetConnectedToId(other.pinId) === netId)
          .map((other) => other.pinId),
        traces,
      }).find((component) => component.pinIds.includes(pin.pinId))!
      const pinLabels = labels.filter((label) =>
        label.pinIds.some((pinId) => component.pinIds.includes(pinId)),
      )
      expect(pinLabels).toHaveLength(1)
      expect(pinLabels[0]!.globalConnNetId).toBe(netId)
      // Shared rails stay just outside the row instead of alternating above
      // and below components or running back to the IC.
      const sign = groundPins.has(pin.pinId) ? -1 : 1
      for (const trace of component.traces) {
        for (const point of trace.tracePath) {
          expect(sign * (point.y - pin.y)).toBeGreaterThanOrEqual(-1e-6)
          expect(sign * (point.y - pin.y)).toBeLessThanOrEqual(0.5)
        }
      }
      if (groundPins.has(pin.pinId)) {
        expect(component.pinIds).toHaveLength(
          pin.y > 0 ? 13 : pin.x < 0 ? 6 : 4,
        )
        expect(pinLabels[0]).toMatchObject({ orientation: "y-" })
      }
    }
  }
})
