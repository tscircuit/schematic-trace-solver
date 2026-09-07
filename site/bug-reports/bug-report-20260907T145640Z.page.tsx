import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260907T145640Z/bug-report-20260907T145640Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
