import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { evaluateRailGroup } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/evaluateRailGroup"
import { getRailGroups } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/getRailGroups"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { readFileSync } from "node:fs"
const problem = JSON.parse(readFileSync("tests/assets/example45.json", "utf8"))
const s: any = new SchematicTracePipelineSolver(problem)
s.solve()
const traces = s.netLabelToTraceSolver?.getOutput?.().traces ?? []
const labels = s.netLabelPlacementSolver?.getOutput?.().netLabelPlacements ?? []
const obstacles = getObstacleRects(problem)
const groups = getRailGroups(traces, new Set(traces.map((t: any) => t.mspPairId)), problem, obstacles, labels)
console.log("groups:", groups.length, "sizes:", groups.map((g: any) => g.length))
for (const g of groups) {
  const r: any = evaluateRailGroup({ inputProblem: problem, group: g, traces, netLabelPlacements: labels, obstacles, eligibleTraceIds: new Set(traces.map((t: any) => t.mspPairId)) } as any)
  console.log("group", g.length, "->", JSON.stringify(r && { ok: !!r, keys: Object.keys(r), reason: r?.reason ?? r?.rejectionReason }))
}
