import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { useMemo } from "react"
import type { InputProblem } from "lib/types/InputProblem"
import { SchematicTracePipelineSolver } from "lib/index"

/**
 * Example that reproduces issue #34: same-net trace lines that are close
 * together should be merged (snapped to the same Y or same X coordinate).
 *
 * This uses the same circuit as SchematicTracePipelineSolver01 which has
 * V3_3 and GND nets with multiple pins producing parallel traces.
 */
const inputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: 0, y: 0 },
      width: 2,
      height: 1.4,
      pins: [
        { pinId: "U3.8", x: -1.4, y: 0.425 },
        { pinId: "U3.4", x: -1.4, y: -0.425 },
        { pinId: "U3.1", x: 1.4, y: 0.5 },
        { pinId: "U3.6", x: 1.4, y: 0.3 },
        { pinId: "U3.5", x: 1.4, y: 0.1 },
        { pinId: "U3.2", x: 1.4, y: -0.1 },
        { pinId: "U3.3", x: 1.4, y: -0.3 },
        { pinId: "U3.7", x: 1.4, y: -0.5 },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: { x: -2.3145833, y: 0 },
      width: 0.5291666,
      height: 1.0583333,
      pins: [
        { pinId: "C20.1", x: -2.3148567, y: 0.5512093 },
        { pinId: "C20.2", x: -2.3143100, y: -0.5512093 },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: { x: 1.7577928, y: 1.7512907 },
      width: 0.3155857,
      height: 1.0583333,
      pins: [
        { pinId: "R11.1", x: 1.7580661, y: 2.3025814 },
        { pinId: "R11.2", x: 1.7575196, y: 1.2 },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["C20.1", "U3.8"],
      netId: "capacitor.C20 > port.pin1 to .U3 > .VDD",
    },
    {
      pinIds: ["C20.2", "U3.4"],
      netId: "capacitor.C20 > port.pin2 to .U3 > .GND",
    },
    {
      pinIds: ["R11.2", "U3.1"],
      netId: "resistor.R11 > port.pin2 to .U3 > .N_CS",
    },
  ],
  netConnections: [
    {
      netId: "V3_3",
      pinIds: ["U3.8", "U3.3", "U3.7", "C20.1", "R11.1"],
    },
    {
      netId: "GND",
      pinIds: ["U3.4", "C20.2"],
    },
    {
      netId: "FLASH_N_CS",
      pinIds: ["U3.1", "R11.2"],
    },
  ],
  availableNetLabelOrientations: {
    V3_3: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 5,
} as InputProblem

export default () => {
  const solver = useMemo(
    () => new SchematicTracePipelineSolver(inputProblem),
    [],
  )
  return <GenericSolverDebugger solver={solver} />
}
