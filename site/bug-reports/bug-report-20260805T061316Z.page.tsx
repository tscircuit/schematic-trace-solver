import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260805T061316Z/bug-report-20260805T061316Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
