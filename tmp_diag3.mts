import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import inputProblem from './tests/assets/example19.json'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
let stepCount = 0
while (!solver.solved && !solver.failed && stepCount < 200) {
  solver.step()
  stepCount++
  const tlo = solver.traceLabelOverlapAvoidanceSolver
  if (tlo && tlo.getOutput) {
    const out = tlo.getOutput()
    const bad = out.traces.map((t:any,idx:number)=>({idx,valid:t && typeof t==='object' && Array.isArray(t.tracePath), type:Array.isArray(t)?'array':'object', mspPairId:t?.mspPairId})).filter(x=>!x.valid)
    if (bad.length) {
      console.log('bad in traceLabelOverlapAvoidanceSolver output step', stepCount)
      console.log(JSON.stringify(out.traces.map((t:any)=>({type:Array.isArray(t)?'array':'object',mspPairId:t?.mspPairId,tracePathType:Array.isArray(t?.tracePath),len:t?.tracePath?.length, raw:t})), null,2))
      break
    }
  }
}
console.log('end', solver.solved, solver.failed, stepCount)
