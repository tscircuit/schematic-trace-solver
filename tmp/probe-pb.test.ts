import { test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../tests/repros/assets/repro-powerbank-3v-system-power.input.json"
test("probe", () => {
  const s = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })
  s.solve()
  const tr = s.sameNetJunctionAlignmentSolver!.outputTraces
  for (const id of [
    "schematic_port_393-schematic_port_379",
    "schematic_port_391-schematic_port_379",
  ]) {
    const t = tr.find((x: any) => x.mspPairId === id)!
    const p =
      t.pins[0]!.pinId === "schematic_port_379"
        ? t.tracePath
        : [...t.tracePath].reverse()
    console.error(
      id,
      JSON.stringify(
        p.slice(0, 3).map((q: any) => [+q.x.toFixed(2), +q.y.toFixed(2)]),
      ),
    )
  }
})
