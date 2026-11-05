import { test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../tests/repros/assets/repro-offset-crystal-branch-junction.input.json"
test("probe", () => {
  const s = new SchematicTracePipelineSolver(
    JSON.parse(JSON.stringify(inputProblem)) as any,
  )
  s.solve()
  const traces = (s as any).schematicTraceLinesSolver.solvedTracePaths ?? []
  console.error(
    "count",
    traces.length,
    Object.keys(s as any).filter((k) => /trace/i.test(k)),
  )
  for (const t of traces)
    console.error(
      t.mspPairId,
      JSON.stringify(
        t.tracePath.map((p: any) => [+p.x.toFixed(2), +p.y.toFixed(2)]),
      ),
    )
})
