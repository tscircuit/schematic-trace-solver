import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblemJson from "./assets/pullup-rail-missing-power-label.input.json"
import "tests/fixtures/matcher"

// Captured from core 0.0.2359 (schematic-trace-solver 0.0.238). U1.P3 and
// U1.P5 are both on V3_3, R1 pulls U1.P2 up to V3_3, and R2 hangs off U1.P3.
// U1.P5 and R1 reach a V3_3 label, but the U1.P3/R2 island gets no label and
// no trace to the rail, so the schematic shows R2 disconnected from V3_3.
//
//   <chip name="U1" footprint="soic6"
//     pinLabels={{ pin1: "P1", pin2: "P2", pin3: "P3", pin4: "P4", pin5: "P5", pin6: "P6" }}
//     connections={{ P1: "net.TX", P3: "net.V3_3", P5: "net.V3_3" }} />
//   <resistor name="R1" resistance="10k" footprint="0402" connections={{ pin1: "U1.P2", pin2: "net.V3_3" }} />
//   <resistor name="R2" resistance="10k" footprint="0402" connections={{ pin1: "U1.P3", pin2: "net.SDA" }} />
//   <capacitor name="C3" capacitance="100nF" footprint="0402" connections={{ pin1: "net.TX" }} />
//   <capacitor name="C4" capacitance="100nF" footprint="0402" connections={{ pin1: "net.TX", pin2: "U1.P2" }} />
test("repro: U1.P3 and R2 on V3_3 are left without a V3_3 label or trace", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const output = solver.inlineNetLabelSolver!.getOutput()
  const railPinIds = inputProblem.netConnections.find(
    (netConnection) => netConnection.netId === "V3_3",
  )!.pinIds

  const connectedPinIdsByPinId = new Map<string, Set<string>>()
  for (const trace of output.traces) {
    const [pinIdA, pinIdB] = trace.pinIds
    if (!pinIdA || !pinIdB) continue
    if (!connectedPinIdsByPinId.has(pinIdA))
      connectedPinIdsByPinId.set(pinIdA, new Set())
    if (!connectedPinIdsByPinId.has(pinIdB))
      connectedPinIdsByPinId.set(pinIdB, new Set())
    connectedPinIdsByPinId.get(pinIdA)!.add(pinIdB)
    connectedPinIdsByPinId.get(pinIdB)!.add(pinIdA)
  }

  const pinIdsReachingRailLabel = new Set(
    output.netLabelPlacements
      .filter((netLabel) => netLabel.netId === "V3_3")
      .flatMap((netLabel) => netLabel.pinIds),
  )
  const pinIdsToVisit = [...pinIdsReachingRailLabel]
  while (pinIdsToVisit.length > 0) {
    const pinId = pinIdsToVisit.pop()!
    for (const connectedPinId of connectedPinIdsByPinId.get(pinId) ?? []) {
      if (pinIdsReachingRailLabel.has(connectedPinId)) continue
      pinIdsReachingRailLabel.add(connectedPinId)
      pinIdsToVisit.push(connectedPinId)
    }
  }

  const railPinIdsWithoutLabel = railPinIds.filter(
    (pinId) => !pinIdsReachingRailLabel.has(pinId),
  )
  // U1.P3 (schematic_port_2) and R2.pin1 (schematic_port_8)
  expect(railPinIdsWithoutLabel.sort()).toEqual([
    "schematic_port_2",
    "schematic_port_8",
  ])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
