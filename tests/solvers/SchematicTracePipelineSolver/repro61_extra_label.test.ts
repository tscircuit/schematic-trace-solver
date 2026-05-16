import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import connectedInput from "../../assets/connected-gnd-vcc.json"
import unconnectInput from "../../assets/unconnect-gnd-vcc.json"
import type { InputProblem } from "lib/types/InputProblem"

test("repro61: extra net label when direct connection exists", () => {
  const solver = new SchematicTracePipelineSolver(connectedInput as any as InputProblem)
  solver.solve()
  
  const labels = solver.netLabelPlacementSolver!.netLabelPlacements
  const gndLabels = labels.filter(l => l.netId === "GND")
  const vccLabels = labels.filter(l => l.netId === "VCC")
  
  console.log("Connected case - GND labels:", gndLabels.length)
  console.log("Connected case - VCC labels:", vccLabels.length)

  // In the connected case, GND pins C1.1 and C2.1 are ALREADY connected via directConnections.
  // So there should be 0 net labels for GND because they are on the same trace.
  expect(gndLabels.length).toBe(0)
})

test("repro61: net labels should exist when NO direct connection exists", () => {
  const solver = new SchematicTracePipelineSolver(unconnectInput as any as InputProblem)
  solver.solve()
  
  const labels = solver.netLabelPlacementSolver!.netLabelPlacements
  const gndLabels = labels.filter(l => l.netId === "GND")
  const vccLabels = labels.filter(l => l.netId === "VCC")

  console.log("Disconnected case - GND labels:", gndLabels.length)
  console.log("Disconnected case - VCC labels:", vccLabels.length)

  // In the disconnected case, they should have net labels to show connectivity.
  expect(gndLabels.length).toBeGreaterThan(0)
})
