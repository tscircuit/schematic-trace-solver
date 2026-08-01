import inputProblem from './tests/repros/assets/repro47-endpoint-obstacle-detour.input.json'
import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import { countPathIntersections } from './lib/solvers/Example28Solver/geometry.ts'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
solver.solve()
const finalTraces = solver.netLabelTraceCollisionSolver!.getOutput().traces
const traceById = new Map(finalTraces.map((trace:any) => [trace.mspPairId, trace]))
const a = traceById.get('J1.1-R1.1')
const b = traceById.get('R2.2-R3.1')
if (!a || !b) {
  console.log('missing trace', !!a, !!b)
} else {
  console.log('intersection', countPathIntersections(a.tracePath, b.tracePath))
  console.log('a', JSON.stringify(a.tracePath, null, 2))
  console.log('b', JSON.stringify(b.tracePath, null, 2))
}
