import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "tests/fixtures/convertSolverOutputToCircuitJson"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-missing-interior-junction-dot.input.json"

// Synthetic three-pin net, in schematic mm (+X right, +Y up). The router
// creates a T at (2, 0), but the semantic snapshot loses the junction dot
// because the point lies inside the host segment, not at a stored vertex.
const rotatePoint = ({ x, y }: { x: number; y: number }) => ({
  x: -y || 0,
  y: x,
})
const rotatedDirections = {
  "x+": "y+",
  "y+": "x-",
  "x-": "y-",
  "y-": "x+",
} as const

for (const orientation of ["horizontal", "vertical"] as const) {
  test(`reproduces the missing dot on a ${orientation} host wire`, async () => {
    const input = structuredClone(inputProblem) as unknown as InputProblem
    const rotate = orientation === "vertical"
    if (rotate) {
      for (const chip of input.chips) {
        chip.center = rotatePoint(chip.center)
        ;[chip.width, chip.height] = [chip.height, chip.width]
        for (const pin of chip.pins) {
          Object.assign(pin, rotatePoint(pin))
          pin._facingDirection = rotatedDirections[pin._facingDirection!]
        }
      }
    }

    const solver = new SchematicTracePipelineSolver(input, {
      hideRatsNet: true,
    })
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.failed).toBe(false)

    const point = (x: number, y: number) =>
      rotate ? rotatePoint({ x, y }) : { x, y }
    const junction = point(2, 0)
    const { traces } = solver.netLabelToTraceSolver!.getOutput()
    expect(traces).toHaveLength(2)
    const host = traces.find((trace) => trace.pinIds.includes("U2.1"))!
    const branch = traces.find((trace) => trace !== host)!
    expect(host.globalConnNetId).toBe(branch.globalConnNetId)
    // These paths meet exactly. The missing dot is not a routing gap.
    expect(host.tracePath).toEqual([point(0, 0), point(4, 0)])
    expect(branch.tracePath).toEqual([point(2, 2), junction])

    const getJunctions = () =>
      convertSolverOutputToCircuitJson(solver).flatMap((element) =>
        element.type === "schematic_trace" ? element.junctions : [],
      )
    // Pin the current bug; a follow-up fix should emit exactly one junction.
    expect(getJunctions()).toEqual([])
    await expect(solver).toMatchSolverSnapshot(
      import.meta.path,
      `repro-missing-interior-junction-dot-${orientation}`,
    )

    // Diagnostic control: adding a redundant collinear vertex changes no
    // wire geometry, yet makes the existing converter emit the missing dot.
    host.tracePath.splice(1, 0, junction)
    expect(getJunctions()).toEqual([junction])
  })
}
