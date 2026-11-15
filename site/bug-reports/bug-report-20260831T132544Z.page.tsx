import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260831T132544Z/bug-report-20260831T132544Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
