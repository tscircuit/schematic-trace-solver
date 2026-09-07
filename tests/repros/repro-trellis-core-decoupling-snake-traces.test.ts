import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "../bug-reports/bug-report-20260907T110144Z/bug-report-20260907T110144Z.json"

test("Trellis decoupling capacitors keep local rail and ground labels", () => {
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
      // Every capacitor terminal remains electrically connected by a local
      // label; neither the rail nor GND may snake across neighboring parts.
      expect(
        traces.filter(
          (trace) =>
            trace.pinIds.includes(pin.pinId) && trace.pinIds.length > 1,
        ),
      ).toEqual([])
      const pinLabels = labels.filter((label) =>
        label.pinIds.includes(pin.pinId),
      )
      expect(pinLabels).toHaveLength(1)
      expect(pinLabels[0]!.globalConnNetId).toBe(
        netMap.getNetConnectedToId(pin.pinId)!,
      )
      const anchor = pinLabels[0]!.anchorPoint
      expect(
        Math.abs(anchor.x - pin.x) + Math.abs(anchor.y - pin.y),
      ).toBeLessThanOrEqual(inputProblem.maxMspPairDistance)
      if (groundPins.has(pin.pinId)) {
        const groundLabel = netLabelPlacements.find((label) =>
          label.pinIds.includes(pin.pinId),
        )
        expect(groundLabel?.orientation).toBe("y-")
      }
    }
  }
})
