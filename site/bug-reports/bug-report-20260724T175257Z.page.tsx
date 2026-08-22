import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260724T175257Z/bug-report-20260724T175257Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
