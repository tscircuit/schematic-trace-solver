import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import inputProblem from './tests/assets/example19.json'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
let stepCount = 0
while (!solver.solved && !solver.failed && stepCount < 200) {
  solver.step()
  stepCount++
  if (solver.traceLabelOverlapAvoidanceSolver) {
    const out = solver.traceLabelOverlapAvoidanceSolver.getOutput()
    const bad = out.traces.map((t:any,idx:number)=>({idx,valid:t && typeof t==='object' && Array.isArray(t.tracePath), type:Array.isArray(t)?'array':'object', mspPairId:t?.mspPairId})).filter(x=>!x.valid)
    if (bad.length) {
      console.log('bad before traceCleanup step', stepCount, JSON.stringify(bad,null,2))
      console.log('traceLabelOverlapAvoidanceSolver output raw', JSON.stringify(out.traces, null, 2))
      break
    }
  }
  if (solver.traceCleanupSolver) {
    const out = solver.traceCleanupSolver.getOutput()
    const bad = out.traces.map((t:any,idx:number)=>({idx,valid:t && typeof t==='object' && Array.isArray(t.tracePath), type:Array.isArray(t)?'array':'object', mspPairId:t?.mspPairId})).filter(x=>!x.valid)
    if (bad.length) {
      console.log('bad in traceCleanup output', stepCount, JSON.stringify(bad,null,2))
      console.log('traceCleanupSolver output raw', JSON.stringify(out.traces, null, 2))
      break
    }
  }
}
console.log('end', solver.solved, solver.failed, stepCount)
