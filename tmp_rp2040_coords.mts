import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import inputProblem from './tests/repros/assets/repro-rp2040-gamepad-trace-alignment.input.json'
const solver = new SchematicTracePipelineSolver(inputProblem as any, { hideRatsNet: true })
solver.solve()
const finalTraces = solver.netLabelTraceCollisionSolver!.getOutput().traces.filter((trace:any)=>trace.userNetId==='GND')
for (const trace of finalTraces) {
  const xs = new Set<number>()
  const segs: Array<{x:number, start:any, end:any}> = []
  for (let i=0;i<trace.tracePath.length-1;i++) {
    const s = trace.tracePath[i]!
    const e = trace.tracePath[i+1]!
    if (Math.abs(s.x-e.x) < 1e-6) {
      if (s.x < -1.778 - 1e-6 || s.x > 1.778 + 1e-6) {
        xs.add(s.x)
        segs.push({x:s.x,start:s,end:e})
      }
    }
  }
  console.log('TRACE', trace.mspPairId, Array.from(xs).map(x=>x.toFixed(6)), segs.length)
}
