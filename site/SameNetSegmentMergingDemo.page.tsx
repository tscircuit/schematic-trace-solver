import { GenericSolverDebugger } from "site/components/GenericSolverDebugger";
import { useMemo } from "react";
import type { InputProblem } from "lib/types/InputProblem";
import { SchematicTracePipelineSolver } from "lib/index";

const inputProblem = {
  chips: [
    {
      chipId: "chip1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      pins: [
        { pinId: "pin1", x: -1, y: 0.5 },
        { pinId: "pin2", x: -1, y: -0.5 },
        { pinId: "pin3", x: 1, y: 0.5 },
        { pinId: "pin4", x: 1, y: -0.5 },
      ],
    },
    {
      chipId: "chip2",
      center: { x: 3, y: 0 },
      width: 1,
      height: 1,
      pins: [
        { pinId: "pin5", x: 2.5, y: 0.3 },
        { pinId: "pin6", x: 2.5, y: -0.3 },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["pin1", "pin3"], netId: "NET1" },
    { pinIds: ["pin2", "pin4"], netId: "NET2" },
    { pinIds: ["pin3", "pin5"], netId: "NET1" },
    { pinIds: ["pin4", "pin6"], netId: "NET2" },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 5,
} as InputProblem;

export default () => {
  const solver = useMemo(
    () => new SchematicTracePipelineSolver(inputProblem),
    [],
  );
  return <GenericSolverDebugger solver={solver} />;
};
