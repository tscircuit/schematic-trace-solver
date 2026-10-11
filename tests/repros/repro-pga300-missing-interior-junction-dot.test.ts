import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-pga300-missing-interior-junction-dot.input.json"

// Unmodified full-board capture from tscircuit/ti#117 at 067b6a2,
// originally committed in schematic-trace-solver#930 at e51b323.
// See the companion notes for source links and capture provenance.
test("PGA300 supply branches lose junction dots at wire interiors", async () => {
  const input = structuredClone(inputProblem) as unknown as InputProblem
  expect(input.chips).toHaveLength(17)
  expect(input.chips.flatMap((chip) => chip.pins)).toHaveLength(55)
  const solver = new SchematicTracePipelineSolver(input, { hideRatsNet: true })
  solver.solve()
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
      junction: { x: 5.49, y: 3.05 },
      segment: [
        { x: 7, y: 3.05 },
        { x: 2.55, y: 3.05 },
      ],
    },
    {
      host: q1Branch,
      branch: c4Branch,
      junction: { x: 5.49, y: 1.29945535 },
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

  const circuitJson = convertSolverOutputToCircuitJson(solver)
  const junctionsAt = (point: { x: number; y: number }) =>
    convertSolverOutputToCircuitJson(solver)
      .flatMap((element) =>
        element.type === "schematic_trace" ? element.junctions : [],
      )
      .filter(
        (junction) =>
          Math.abs(junction.x - point.x) < 1e-6 &&
          Math.abs(junction.y - point.y) < 1e-6,
      )
  // Pin the current converter defect on the actual captured board.
  for (const { junction } of contacts) expect(junctionsAt(junction)).toEqual([])
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
  await expect(
    convertCircuitJsonToSchematicSvg(circuitJson, {
      width: 1600,
      height: 800,
    }).replace(/[ \t]+$/gm, ""),
  ).toMatchSvgSnapshot(
    import.meta.path,
    "repro-pga300-missing-interior-junction-dot-schematic",
  )

  // Diagnostic control after snapshots: adding redundant collinear vertices
  // changes no wire geometry, but causes both missing dots to be emitted.
  for (const { host, junction } of contacts)
    host.tracePath.splice(1, 0, junction)
  for (const { junction } of contacts)
    expect(junctionsAt(junction)).toEqual([junction])
})
