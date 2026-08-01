import inputProblem from './tests/repros/assets/repro47-endpoint-obstacle-detour.input.json'
import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import { countPathIntersections } from './lib/solvers/Example28Solver/geometry.ts'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
solver.solve()
const pre = solver.preAlignmentNetLabelTraceCollisionSolver!.getOutput().traces
const post = solver.netLabelTraceCollisionSolver!.getOutput().traces
const ids=['R2.1-R3.2','R2.2-R3.1']
for (const phase of ['pre','post'] as const) {
  const traces = phase==='pre'? pre: post
  const a= traces.find((t:any)=>t.mspPairId==='R2.1-R3.2')
  const b= traces.find((t:any)=>t.mspPairId==='R2.2-R3.1')
  console.log('phase',phase,'hasA',!!a,'hasB',!!b)
  if (a && b) {
    console.log(phase,'count',countPathIntersections(a.tracePath,b.tracePath))
    console.log(phase,'A',JSON.stringify(a.tracePath,null,2))
    console.log(phase,'B',JSON.stringify(b.tracePath,null,2))
  }
}
