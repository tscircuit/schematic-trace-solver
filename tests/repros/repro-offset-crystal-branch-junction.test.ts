import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  SchematicPort,
  SchematicTrace,
  SourcePort,
} from "circuit-json"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import { getSolverSnapshotSvg } from "tests/fixtures/matcher"
import inputProblem from "./assets/repro-offset-crystal-branch-junction.input.json"

const solverInput: InputProblem = JSON.parse(JSON.stringify(inputProblem))

const isSourcePort = (element: AnyCircuitElement): element is SourcePort =>
  element.type === "source_port"

const isSchematicPort = (
  element: AnyCircuitElement,
): element is SchematicPort => element.type === "schematic_port"

const isSchematicTrace = (
  element: AnyCircuitElement,
): element is SchematicTrace => element.type === "schematic_trace"

// Complete solver input captured from @tscircuit/core's crystal junction repro,
// with component names and symbols restored for a faithful snapshot.
test("aligns the crystal branch with its junction", () => {
  const solver = new SchematicTracePipelineSolver(solverInput)

  solver.solve()

  expect(solver.solved).toBe(true)

  const circuitJson = convertSolverOutputToCircuitJson(solver)
  const y1SourceComponent = circuitJson.find(
    (element) => element.type === "source_component" && element.name === "Y1",
  )
  if (!y1SourceComponent || y1SourceComponent.type !== "source_component") {
    throw new Error("Y1 source component is missing")
  }
  const y1SchematicComponent = circuitJson.find(
    (element) =>
      element.type === "schematic_component" &&
      element.source_component_id === y1SourceComponent.source_component_id,
  )
  if (
    !y1SchematicComponent ||
    y1SchematicComponent.type !== "schematic_component"
  ) {
    throw new Error("Y1 schematic component is missing")
  }

  y1SchematicComponent.center = { x: 0, y: 0 }
  y1SchematicComponent.size = { width: 1.08, height: 1.42 }
  y1SchematicComponent.symbol_name = "crystal_4pin_right"

  const y1PortPositions = {
    gnd1: { x: 0, y: 0.71 },
    gnd2: { x: -0.02, y: -0.71 },
    X1: { x: -0.54, y: -0.01 },
    X2: { x: 0.54, y: -0.01 },
  }
  const y1SchematicPorts = circuitJson.filter(
    (element): element is SchematicPort =>
      isSchematicPort(element) &&
      element.schematic_component_id ===
        y1SchematicComponent.schematic_component_id,
  )
  for (const schematicPort of y1SchematicPorts) {
    const sourcePort = circuitJson.find(
      (element): element is SourcePort =>
        isSourcePort(element) &&
        element.source_port_id === schematicPort.source_port_id,
    )
    if (!sourcePort) continue
    const position = Object.entries(y1PortPositions).find(
      ([portName]) => portName === sourcePort.name,
    )?.[1]
    if (position) schematicPort.center = position
  }

  const x2SourcePort = circuitJson.find(
    (element): element is SourcePort =>
      isSourcePort(element) &&
      element.source_component_id === y1SourceComponent.source_component_id &&
      element.name === "X2",
  )
  const x2SchematicPort = circuitJson.find(
    (element): element is SchematicPort =>
      isSchematicPort(element) &&
      element.source_port_id === x2SourcePort?.source_port_id,
  )
  if (!x2SchematicPort) {
    throw new Error("Y1 X2 schematic port is missing")
  }

  const x2Traces = circuitJson.filter(
    (element): element is SchematicTrace =>
      isSchematicTrace(element) &&
      element.edges.at(-1)?.to_schematic_port_id ===
        x2SchematicPort.schematic_port_id,
  )
  // both branches into X2 now share one corridor, so the pipeline emits a single
  // trace: what matters is that it arrives horizontally instead of at an angle
  expect(x2Traces).toHaveLength(1)
  for (const trace of x2Traces) {
    const terminalEdge = trace.edges.at(-1)!
    // the branch runs along the junction rail, so it arrives without a sideways jog
    expect(terminalEdge.from.y).toBeCloseTo(terminalEdge.to.y, 1)
    const junctionPoint = { ...terminalEdge.to }
    terminalEdge.to_schematic_port_id = undefined
    trace.edges.push({
      from: terminalEdge.to,
      to: x2SchematicPort.center,
      to_schematic_port_id: x2SchematicPort.schematic_port_id,
    })
    trace.junctions = [junctionPoint]
  }

  expect(getSolverSnapshotSvg({ solver, circuitJson })).toMatchSvgSnapshot(
    import.meta.path,
  )
})
