import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import inputProblem from './tests/repros/assets/repro47-endpoint-obstacle-detour.input.json'
import { countPathIntersections } from './lib/solvers/Example28Solver/geometry.ts'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
solver.solve()
const names = ['schematicTraceLinesSolver','unroutedTraceRecoverySolver','traceOverlapShiftSolver','netLabelPlacementSolver','traceLabelOverlapAvoidanceSolver','traceCleanupSolver','preAlignmentNetLabelTraceCollisionSolver','traceCleanupSolver2','netLabelTraceCollisionSolver'] as const
for (const name of names) {
  const stage = (solver as any)[name]
  console.log('stage', name, !!stage, stage?.solved, stage?.failed)
}
const finalTraces = solver.netLabelTraceCollisionSolver!.getOutput().traces
const get = (id:string) => finalTraces.find((t:any)=>t.mspPairId===id)
const a = get('J1.1-R1.1')
const b = get('R2.2-R3.1')
console.log('a', a?.tracePath)
console.log('b', b?.tracePath)
console.log('intersection', countPathIntersections(a.tracePath,b.tracePath))
const pre = solver.preAlignmentNetLabelTraceCollisionSolver!.getOutput().traces
const pa = pre.find((t:any)=>t.mspPairId==='J1.1-R1.1')
const pb = pre.find((t:any)=>t.mspPairId==='R2.2-R3.1')
console.log('pre intersection', countPathIntersections(pa.tracePath,pb.tracePath))
console.log('traceCleanupSolver2 stats', solver.traceCleanupSolver2!.stats)
