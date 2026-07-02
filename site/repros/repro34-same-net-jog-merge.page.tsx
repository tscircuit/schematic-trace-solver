import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/assets/example19.json"

/**
 * Repro for issue #34: same-net trace lines that are close together should
 * be merged onto the same Y (or X).
 *
 * example19 exhibits the canonical case: two same-net vertical runs at
 * x=3.6 and x=3.5256 joining at pin JP5.1 with a 0.0744 jog. After the
 * merging_same_net_segments cleanup step they share a single x.
 */
export { inputProblem }

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
