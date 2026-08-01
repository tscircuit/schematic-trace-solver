import { SchematicTracePipelineSolver } from './lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver.ts'
import inputProblem from './tests/assets/example19.json'
const solver = new SchematicTracePipelineSolver(inputProblem as any)
let stepCount = 0
while (!solver.solved && !solver.failed && stepCount < 100) {
  solver.step()
  stepCount++
  const nl = solver.netLabelPlacementSolver
  if (nl) {
    const invalid = Object.entries(nl.inputTraceMap).filter(([, solved]) => !solved || !Array.isArray(solved.tracePath))
    if (invalid.length) {
      console.log('invalid before step', stepCount, invalid.length)
      console.log(JSON.stringify(invalid.slice(0,10).map(([k,v]) => [k, v]), null, 2))
      break
    }
  }
}
console.log('done', solver.solved, solver.failed, stepCount)
