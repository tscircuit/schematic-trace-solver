import fs from 'fs/promises'
import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver'
import { getRailGroups } from './lib/solvers/TraceCleanupSolver/sameNetRailAlignment/getRailGroups'
import { getObstacleRects } from './lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect'

async function main() {
  const inputProblem = JSON.parse(await fs.readFile('./tests/repros/assets/repro-rp2040-gamepad-trace-alignment.input.json','utf8'))
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  const traces = solver.traceCleanupSolver2?.getOutput().traces ?? []
  const left = new Set<number>()
  const right = new Set<number>()
  for (const trace of traces.filter((t: any)=> t.userNetId === 'GND')) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const a = trace.tracePath[i]!
      const b = trace.tracePath[i + 1]!
      if (Math.abs(a.x - b.x) > 1e-6) continue
      if (a.x < -1.778 - 1e-6) left.add(a.x)
      if (a.x > 1.778 + 1e-6) right.add(a.x)
    }
  }
  console.log('left xs', [...left].sort((a,b)=>a-b))
  console.log('right xs', [...right].sort((a,b)=>a-b))
  const eligible = new Set((solver.traceCleanupSolver?.getOutput().traces ?? []).map((t:any)=>t.mspPairId))
  const groups = getRailGroups(traces, eligible, solver.inputProblem, getObstacleRects(solver.inputProblem))
  console.log('groups count', groups.length)
  for (const [i,g] of groups.entries()) {
    console.log('group', i, 'size', g.length, 'traceCount', new Set(g.map((s:any)=>s.traceId)).size)
    console.log(g.map((s:any)=>({id:s.traceId, orientation:s.orientation, coordinate:s.coordinate, segmentIndex:s.segmentIndex})))
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
