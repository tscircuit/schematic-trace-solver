import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"
import input from "../../tests/repros/assets/usb-c-ethernet-schematic.input.json"

export default () => <PipelineDebugger inputProblem={input as InputProblem} />
