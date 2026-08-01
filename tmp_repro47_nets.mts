import inputProblem from './tests/repros/assets/repro47-endpoint-obstacle-detour.input.json'
import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
solver.solve()
const finalTraces = solver.netLabelTraceCollisionSolver!.getOutput().traces
type Trace = any
const a: Trace = finalTraces.find((t:any)=>t.mspPairId==='R2.1-R3.2')
const b: Trace = finalTraces.find((t:any)=>t.mspPairId==='R2.2-R3.1')
console.log('a net', a?.globalConnNetId, a?.userNetId, a?.dcConnNetId)
console.log('b net', b?.globalConnNetId, b?.userNetId, b?.dcConnNetId)
console.log('anchor a', a?.pins?.map((p:any)=>p.pinId))
console.log('anchor b', b?.pins?.map((p:any)=>p.pinId))
