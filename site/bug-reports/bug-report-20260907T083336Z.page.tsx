import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260907T083336Z/bug-report-20260907T083336Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
