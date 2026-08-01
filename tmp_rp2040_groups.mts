import { getRailGroups } from './lib/solvers/TraceCleanupSolver/sameNetRailAlignment/getRailGroups.ts'
import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import inputProblem from './tests/repros/assets/repro-rp2040-gamepad-trace-alignment.input.json'
const solver = new SchematicTracePipelineSolver(inputProblem as any, { hideRatsNet: true })
solver.solve()
const collapse = (arr:any[])=>arr.map(a=>({traceId:a.traceId,coordinate:a.coordinate,orientation:a.orientation,componentId:a.componentId,componentFacingDirection:a.componentFacingDirection,minAlong:a.minAlong,maxAlong:a.maxAlong}))
const collisionOutput = solver.preAlignmentNetLabelTraceCollisionSolver!.getOutput()
const labelMergingOutput = solver.traceLabelOverlapAvoidanceSolver!.labelMergingSolver!.getOutput()
const allTraces = collisionOutput.traces
const eligible = new Set(solver.traceCleanupSolver!.getOutput().traces.map((trace:any)=>trace.mspPairId))
const obstacles = []
const groups = getRailGroups(allTraces, eligible, inputProblem, obstacles)
console.log('groups', groups.length)
for (const group of groups) {
  console.log('group', group.map((s:any)=>({traceId:s.traceId,coord:s.coordinate,orient:s.orientation,componentId:s.componentId,face:s.componentFacingDirection,range:[s.minAlong,s.maxAlong]})))
}
