import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import inputProblem from './tests/repros/assets/repro-rp2040-gamepad-trace-alignment.input.json'
const solver = new SchematicTracePipelineSolver(inputProblem as any, { hideRatsNet: true })
solver.solve()

const cleanup2 = solver.traceCleanupSolver2!
console.log('cleanup2 solved', cleanup2.solved, 'failed', cleanup2.failed)
console.log('cleanup2 stats', cleanup2.stats)
const cleanup2Traces = cleanup2.getOutput().traces.filter((trace:any)=>trace.userNetId==='GND')
const collect = (name: string, traces:any[]) => {
  const xs = new Set<number>()
  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length-1; i++) {
      const start = trace.tracePath[i]!
      const end = trace.tracePath[i+1]!
      if (Math.abs(start.x - end.x) > 1e-6) continue
      if (start.x < -1.778 - 1e-6) xs.add(start.x)
      if (start.x > 1.778 + 1e-6) xs.add(start.x)
    }
  }
  console.log(name, xs.size, Array.from(xs).sort((a,b)=>a-b))
}
collect('cleanup2', cleanup2Traces)

const finalTraces = solver.netLabelTraceCollisionSolver!.getOutput().traces.filter((trace:any)=>trace.userNetId==='GND')
collect('final', finalTraces)

console.log('trace counts', cleanup2Traces.length, finalTraces.length)
for (const trace of finalTraces) {
  if (!trace.userNetId) continue
  if (trace.userNetId==='GND') {
    const xs = new Set<number>()
    for (let i=0;i<trace.tracePath.length-1;i++) {
      const s=trace.tracePath[i]!
      const e=trace.tracePath[i+1]!
      if (Math.abs(s.x-e.x)<1e-6 && (s.x < -1.778-1e-6 || s.x > 1.778+1e-6)) xs.add(s.x)
    }
    if (xs.size>1) console.log('trace',trace.mspPairId,'xs',Array.from(xs).sort((a,b)=>a-b))
  }
}
