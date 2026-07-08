import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260708T095725Z/bug-report-20260708T095725Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
