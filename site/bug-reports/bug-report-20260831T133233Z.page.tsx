import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260831T133233Z/bug-report-20260831T133233Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
