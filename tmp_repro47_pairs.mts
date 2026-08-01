import inputProblem from './tests/repros/assets/repro47-endpoint-obstacle-detour.input.json'
import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import { countPathIntersections } from './lib/solvers/Example28Solver/geometry.ts'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
solver.solve()
const finalTraces = solver.netLabelTraceCollisionSolver!.getOutput().traces
const traceById = new Map(finalTraces.map((trace:any) => [trace.mspPairId, trace]))
const pairs = [['J1.1-R1.1','R2.2-R3.1'], ['J1.3-R1.2','R2.1-R3.2'], ['R2.1-R3.2','R2.2-R3.1']]
for (const [aId,bId] of pairs) {
  const a=traceById.get(aId)
  const b=traceById.get(bId)
  console.log(aId,bId,'exists',!!a,!!b)
  if (a && b) {
    console.log('count', countPathIntersections(a.tracePath,b.tracePath))
    console.log('a',JSON.stringify(a.tracePath,null,2))
    console.log('b',JSON.stringify(b.tracePath,null,2))
  }
}
