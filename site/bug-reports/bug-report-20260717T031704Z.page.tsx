import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260717T031704Z/bug-report-20260717T031704Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
