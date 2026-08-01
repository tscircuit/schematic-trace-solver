import inputProblem from './tests/repros/assets/repro47-endpoint-obstacle-detour.input.json'
import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import { countPathIntersections } from './lib/solvers/Example28Solver/geometry.ts'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
solver.solve()
const finalTraces = solver.netLabelTraceCollisionSolver!.getOutput().traces
const traceById = new Map(finalTraces.map((trace:any) => [trace.mspPairId, trace]))
console.log('has J1.1-R1.1', traceById.has('J1.1-R1.1'))
console.log('has R2.2-R3.1', traceById.has('R2.2-R3.1'))
const a = traceById.get('J1.1-R1.1')
const b = traceById.get('R2.2-R3.1')
console.log('a is undefined?', a===undefined)
console.log('b is undefined?', b===undefined)
if (a && b) {
  console.log('count', countPathIntersections(a.tracePath, b.tracePath))
  console.log('a len', a.tracePath.length)
  console.log('b len', b.tracePath.length)
}
