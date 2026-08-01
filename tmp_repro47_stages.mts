import inputProblem from './tests/repros/assets/repro47-endpoint-obstacle-detour.input.json'
import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import { countPathIntersections } from './lib/solvers/Example28Solver/geometry.ts'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
solver.solve()
const stages = [
  'schematicTraceLinesSolver',
  'unroutedTraceRecoverySolver',
  'traceOverlapShiftSolver',
  'netLabelPlacementSolver',
  'traceLabelOverlapAvoidanceSolver',
  'traceCleanupSolver',
  'preAlignmentNetLabelTraceCollisionSolver',
  'traceCleanupSolver2',
  'netLabelTraceCollisionSolver',
] as const
for (const stageName of stages) {
  const stage = (solver as any)[stageName]
  let traces:any[] = []
  if (!stage) continue
  if (stageName === 'schematicTraceLinesSolver') traces = stage.solvedTracePaths
  else if (stageName === 'traceOverlapShiftSolver') traces = Object.values(stage.correctedTraceMap)
  else if (stageName === 'netLabelPlacementSolver') traces = Object.values(stage.inputTraceMap)
  else if (stageName === 'traceLabelOverlapAvoidanceSolver') traces = stage.getOutput().traces
  else if (stageName === 'traceCleanupSolver') traces = stage.getOutput().traces
  else if (stageName === 'preAlignmentNetLabelTraceCollisionSolver') traces = stage.getOutput().traces
  else if (stageName === 'traceCleanupSolver2') traces = stage.getOutput().traces
  else if (stageName === 'netLabelTraceCollisionSolver') traces = stage.getOutput().traces
  else if (stageName === 'unroutedTraceRecoverySolver') traces = stage.getOutput().allTracesMerged
  const trace=traces.find((t:any)=>t.mspPairId==='R2.1-R3.2')
  const trace2=traces.find((t:any)=>t.mspPairId==='R2.2-R3.1')
  console.log('stage',stageName,'has1',!!trace,'has2',!!trace2)
  if (trace&&trace2) {
    console.log('count',countPathIntersections(trace.tracePath,trace2.tracePath))
    console.log('1',JSON.stringify(trace.tracePath,null,2))
    console.log('2',JSON.stringify(trace2.tracePath,null,2))
  }
}
