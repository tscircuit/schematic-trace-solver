import { useMemo } from "react"
import { GenericSolverDebugger } from "../components/GenericSolverDebugger"
import { SchematicTraceLinesSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import inputProblem from "./SchematicTraceLinesSolver02_params.json"

export default () => {
  const solver = useMemo(() => {
    return new SchematicTraceLinesSolver(inputProblem as any)
  }, [])
  return <GenericSolverDebugger solver={solver} />
}
