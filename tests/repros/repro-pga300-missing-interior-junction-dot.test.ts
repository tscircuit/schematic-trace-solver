import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-pga300-missing-interior-junction-dot.input.json"

// Full-board PGA300 capture from tscircuit/ti#117 at 067b6a2, copied unchanged
// from schematic-trace-solver#930 at e51b323 (before fixture normalization).
// Circuit source: https://github.com/tscircuit/ti/blob/067b6a211b04bea3840fdd6b59cac6e5e9b0ed61/lib/subcircuits/PressureTransmitter_PGA300.circuit.tsx
const solveRepro = () => {
  const input = structuredClone(inputProblem) as unknown as InputProblem
  const solver = new SchematicTracePipelineSolver(input, { hideRatsNet: true })
  solver.solve()
  return solver
}

const junctions = [
  { x: 5.49, y: 3.05 },
  { x: 5.49, y: 1.29945535 },
]
const junctionsAt = (
  solver: SchematicTracePipelineSolver,
  point: { x: number; y: number },
) =>
  convertSolverOutputToCircuitJson(solver)
    .flatMap((element) =>
      element.type === "schematic_trace" ? element.junctions : [],
    )
    .filter(
      (junction) =>
        Math.abs(junction.x - point.x) < 1e-6 &&
        Math.abs(junction.y - point.y) < 1e-6,
    )

test("repro: PGA300 supply branches lose junction dots at wire interiors", async () => {
  const input = inputProblem as unknown as InputProblem
  expect(input.chips).toHaveLength(17)
  expect(input.chips.flatMap((chip) => chip.pins)).toHaveLength(55)
  const solver = solveRepro()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const { traces } = solver.netLabelToTraceSolver!.getOutput()
  const findTrace = (a: string, b: string) => {
    const trace = traces.find(
      (trace) => trace.pinIds.includes(a) && trace.pinIds.includes(b),
    )
    expect(trace).toBeDefined()
    return trace!
  }
  const supplyRail = findTrace("schematic_port_43", "schematic_port_3")
  const q1Branch = findTrace("schematic_port_33", "schematic_port_43")
  const c4Branch = findTrace("schematic_port_41", "schematic_port_33")
  const contacts = [
    {
      host: supplyRail,
      branch: q1Branch,
      junction: junctions[0],
      segment: [
        { x: 7, y: 3.05 },
        { x: 2.55, y: 3.05 },
      ],
    },
    {
      host: q1Branch,
      branch: c4Branch,
      junction: junctions[1],
      segment: [
        { x: 5.49, y: 1.0994553499999997 },
        { x: 5.49, y: 3.05 },
      ],
    },
  ]
  for (const { host, branch, junction, segment } of contacts) {
    expect(host.globalConnNetId).toBe(branch.globalConnNetId)
    expect(branch.tracePath.at(-1)).toEqual(junction)
    expect(host.tracePath.slice(0, 2)).toEqual(segment)
    expect(host.tracePath).not.toContainEqual(junction)
    // The branch ends strictly inside this axis-aligned segment: no gap.
    const [a, b] = segment
    const axis = a.x === b.x ? "y" : "x"
    const fixedAxis = axis === "x" ? "y" : "x"
    expect(junction[fixedAxis]).toBe(a[fixedAxis])
    expect(junction[axis]).toBeGreaterThan(Math.min(a[axis], b[axis]))
    expect(junction[axis]).toBeLessThan(Math.max(a[axis], b[axis]))
  }

  // Pin the current converter defect on the actual captured board.
  for (const { junction } of contacts)
    expect(junctionsAt(solver, junction)).toEqual([])
  // The snapshot intentionally captures the existing missing dots.
  await expect(solver).toMatchSolverSnapshot(import.meta.path)

  // Diagnostic control after the snapshot: adding redundant collinear vertices
  // changes no wire geometry, but causes both missing dots to be emitted.
  for (const { host, junction } of contacts)
    host.tracePath.splice(1, 0, junction)
  for (const { junction } of contacts)
    expect(junctionsAt(solver, junction)).toEqual([junction])
})

test.failing("PGA300 supply branches should each have one junction dot", () => {
  const solver = solveRepro()
  // Known failure: neither same-net endpoint-to-segment contact gets a dot.
  // Remove .failing when fixing conversion; this assertion should then pass.
  expect(junctions.map((point) => junctionsAt(solver, point))).toEqual(
    junctions.map((point) => [point]),
  )
})
