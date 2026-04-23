fix: expose SchematicTraceSingleLineSolver as part of the public API
Closes #29
export * from "./solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
export * from "./types/InputProblem"
export { SchematicTraceSingleLineSolver2 } from "./solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
export { SchematicTraceSingleLineSolver } from "./solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/SchematicTraceSingleLineSolver"