import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import inputProblem from './tests/assets/example19.json'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
let stepCount = 0
while (!solver.solved && !solver.failed && stepCount < 200) {
  solver.step()
  stepCount++
  const stageNames = ['traceOverlapShiftSolver','netLabelPlacementSolver','traceLabelOverlapAvoidanceSolver','traceCleanupSolver'] as const
  for (const stageName of stageNames) {
    const stage = (solver as any)[stageName]
    if (!stage) continue
    if (stageName === 'traceLabelOverlapAvoidanceSolver') {
      if (stage.getOutput) {
        const out = stage.getOutput()
        if (out && Array.isArray(out.traces)) {
          const invalid = out.traces.map((t:any,idx:number)=>({idx,valid:t && typeof t==='object' && Array.isArray(t.tracePath), type: Array.isArray(t)?'array':'object', mspPairId:t?.mspPairId})).filter(x=>!x.valid)
          if (invalid.length) {
            console.log('bad trace in traceLabelOverlapAvoidanceSolver output at step', stepCount, invalid)
            console.log('all traces debug', out.traces.map((t:any)=>({type:Array.isArray(t)?'array':'object',mspPairId:t?.mspPairId,tracePathType:Array.isArray(t?.tracePath),len:t?.tracePath?.length})))
            throw new Error('bad trace')
          }
        }
      }
    }
    if (stageName === 'traceCleanupSolver') {
      if (stage && stage.getOutput) {
        const out = stage.getOutput()
        if (out && Array.isArray(out.traces)) {
          const invalid = out.traces.map((t:any,idx:number)=>({idx,valid:t && typeof t==='object' && Array.isArray(t.tracePath), type: Array.isArray(t)?'array':'object', mspPairId:t?.mspPairId})).filter(x=>!x.valid)
          if (invalid.length) {
            console.log('bad trace in traceCleanupSolver output at step', stepCount, invalid)
            console.log('all traces debug', out.traces.map((t:any)=>({type:Array.isArray(t)?'array':'object',mspPairId:t?.mspPairId,tracePathType:Array.isArray(t?.tracePath),len:t?.tracePath?.length})))
            throw new Error('bad trace')
          }
        }
      }
    }
  }
  if (solver.netLabelPlacementSolver) {
    const invalid = Object.entries(solver.netLabelPlacementSolver.inputTraceMap).filter(([, solved]: any) => !solved || !Array.isArray(solved.tracePath))
    if (invalid.length) {
      console.log('invalid before step', stepCount, invalid.length, JSON.stringify(invalid.slice(0,10), null,2))
      break
    }
  }
}
console.log('done', solver.solved, solver.failed, stepCount)
