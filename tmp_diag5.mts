import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import inputProblem from './tests/assets/example19.json'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
let stepCount = 0
while (!solver.solved && !solver.failed && stepCount < 200) {
  solver.step()
  stepCount++
  const tos = solver.traceOverlapShiftSolver
  if (tos) {
    const bad = tos.inputTracePaths.map((t:any,idx:number)=>({idx,valid:t && typeof t==='object' && Array.isArray(t.tracePath), type:Array.isArray(t)?'array':'object', mspPairId:t?.mspPairId})).filter(x=>!x.valid)
    if (bad.length) {
      console.log('bad in traceOverlapShiftSolver input at step', stepCount, JSON.stringify(bad,null,2))
      console.log(JSON.stringify(tos.inputTracePaths, null, 2))
      break
    }
  }
  const ur = solver.unroutedTraceRecoverySolver
  if (ur && ur.getOutput) {
    const out = ur.getOutput()
    if (out && Array.isArray(out.allTracesMerged)) {
      const bad = out.allTracesMerged.map((t:any,idx:number)=>({idx,valid:t && typeof t==='object' && Array.isArray(t.tracePath), type:Array.isArray(t)?'array':'object', mspPairId:t?.mspPairId})).filter(x=>!x.valid)
      if (bad.length) {
        console.log('bad in unroutedTraceRecoverySolver output at step', stepCount, JSON.stringify(bad,null,2))
        console.log(JSON.stringify(out.allTracesMerged, null, 2))
        break
      }
    }
  }
}
console.log('end', solver.solved, solver.failed, stepCount)
