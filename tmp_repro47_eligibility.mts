import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import inputProblem from './tests/repros/assets/repro47-endpoint-obstacle-detour.input.json'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
solver.solve()
const cleanup = solver.traceCleanupSolver!
const cleanupIds = cleanup.getOutput().traces.map((t:any)=>t.mspPairId)
console.log('cleanup ids', cleanupIds.length, cleanupIds)
const cleanup2 = solver.traceCleanupSolver2!
const eligible = Array.from(cleanup2['input']?.eligibleTraceIds ?? [])
console.log('eligible ids', eligible.length, eligible)
const collision = solver.preAlignmentNetLabelTraceCollisionSolver!.getOutput().traces.map((t:any)=>t.mspPairId)
console.log('collision ids', collision.length, collision)
