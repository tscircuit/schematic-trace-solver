import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "../../tests/repros/assets/repro-robot-controller-imu-tof.input.json"

export default () => (
  <PipelineDebugger inputProblem={inputProblem as InputProblem} />
)
