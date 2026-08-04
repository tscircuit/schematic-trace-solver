import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/bug-report-20260804T225912Z/bug-report-20260804T225912Z.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
