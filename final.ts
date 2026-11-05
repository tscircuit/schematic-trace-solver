import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { readFileSync } from "node:fs"
const problem = JSON.parse(readFileSync("tests/assets/example45.json", "utf8"))
const s: any = new SchematicTracePipelineSolver(problem)
s.solve()
for (const name of ["traceCleanupSolver", "traceCleanupSolver2"]) {
  const out = s[name]?.getOutput?.()
  const t = out?.traces ?? []
  const verticals: string[] = []
  for (const tr of t) {
    const p = tr.tracePath ?? []
    for (let i = 0; i < p.length - 1; i++) {
      if (Math.abs(p[i].x - p[i + 1].x) < 1e-6 && /U2\.1/.test(tr.mspPairId))
        verticals.push(`${tr.mspPairId}@${p[i].x.toFixed(2)}`)
    }
  }
  console.log(
    name,
    "traces:",
    t.length,
    "U2.1 vertical x:",
    verticals.join(" "),
  )
}
console.log(
  "final",
  (s.unroutedTraceRecoverySolver?.getOutput?.().allTracesMerged ?? [])
    .filter((x: any) => /U2\.1/.test(x.mspPairId))
    .map((x: any) => x.tracePath.map((p: any) => p.x.toFixed(2)).join(","))
    .join(" | "),
)
