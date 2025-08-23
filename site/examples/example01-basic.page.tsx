import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        {
          pinId: "U1.1",
          x: -0.8,
          y: 0.2,
        },
        {
          pinId: "U1.2",
          x: -0.8,
          y: 0,
        },
        {
          pinId: "U1.3",
          x: -0.8,
          y: -0.2,
        },
        {
          pinId: "U1.4",
          x: 0.8,
          y: -0.2,
        },
        {
          pinId: "U1.5",
          x: 0.8,
          y: 0,
        },
        {
          pinId: "U1.6",
          x: 0.8,
          y: 0.2,
        },
      ],
    },
    {
      chipId: "C1",
      center: { x: -2, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        {
          pinId: "C1.1",
          x: -2,
          y: 0.5,
        },
        {
          pinId: "C1.2",
          x: -2,
          y: -0.5,
        },
      ],
    },
    {
      chipId: "C2",
      center: { x: -4, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        {
          pinId: "C2.1",
          x: -4,
          y: 0.5,
        },
        {
          pinId: "C2.2",
          x: -4,
          y: -0.5,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.1", "C1.1"],
      netId: "VCC",
    },
    {
      pinIds: ["U1.2", "C2.1"],
      netId: "VCC",
    },
    {
      pinIds: ["U1.3", "C1.2"],
      netId: "GND",
    },
  ],
  netConnections: [],
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
