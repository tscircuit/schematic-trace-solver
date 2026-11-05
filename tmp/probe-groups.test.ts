import { test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getRailGroups } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/getRailGroups"
import inputProblem from "../tests/repros/assets/repro-powerbank-3v-system-power.input.json"
test("groups", () => {
  const s = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })
  s.solve()
  const tr = s.sameNetJunctionAlignmentSolver!.outputTraces
  const want = tr.filter((t: any) =>
    [
      "schematic_port_393-schematic_port_379",
      "schematic_port_391-schematic_port_379",
    ].includes(t.mspPairId),
  )
  for (const t of want)
    console.error(
      t.mspPairId,
      JSON.stringify(
        t.tracePath.map((q: any) => [+q.x.toFixed(2), +q.y.toFixed(2)]),
      ),
      JSON.stringify(t.pins.map((p: any) => [p.pinId, p.x, p.y])),
    )
})
