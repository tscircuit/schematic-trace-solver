import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260706T220324Z/bug-report-20260706T220324Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
