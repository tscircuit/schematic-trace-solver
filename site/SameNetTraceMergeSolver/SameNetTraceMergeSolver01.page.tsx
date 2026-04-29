import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

export const inputProblem: InputProblem = {
  chips: [
    // JP6 - The chip on the left
    {
      chipId: "JP6",
      center: { x: -4, y: 0 },
      width: 2,
      height: 1.5,
      pins: [
        {
          pinId: "JP6.2", // Top pin (VOUT)
          x: -3,
          y: 0.2,
          _facingDirection: "x+",
        },
        {
          pinId: "JP6.1", // Bottom pin (GND)
          x: -3,
          y: -0.2,
          _facingDirection: "x+",
        },
      ],
    },
    // R1 - The resistor on the right
    {
      chipId: "R1",
      center: { x: 3, y: 0.575 },
      width: 0.6,
      height: 1.2,
      pins: [
        {
          pinId: "R1.1", // Top pin
          x: 3,
          y: 1.175,
          _facingDirection: "y+",
        },
        {
          pinId: "R1.2", // Bottom pin
          x: 3,
          y: -0.025,
          _facingDirection: "y-",
        },
      ],
    },
  ],
  // We use directConnections to explicitly force the "loop" topology
  // described: two parallel lines going to the resistor, and the resistor
  // connected to itself.
  directConnections: [
    {
      // Top trace: JP6 Top -> R1 Top
      pinIds: ["JP6.2", "R1.1"],
    },
    {
      // Bottom trace: JP6 Bottom -> R1 Bottom
      pinIds: ["JP6.1", "R1.2"],
    },
    {
      // Resistor self-connection (Short)
      pinIds: ["R1.1", "R1.2"],
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  // Allow long traces to connect these components
  maxMspPairDistance: 100,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
