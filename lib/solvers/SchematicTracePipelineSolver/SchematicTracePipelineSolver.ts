/**
 * Pipeline solver that runs a series of solvers to find the best schematic layout.
 * Coordinates the entire layout process from chip partitioning through final packing.
 */

import type { GraphicsObject } from "graphics-debug";
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver";
import type { InputProblem } from "lib/types/InputProblem";
import { MspConnectionPairSolver } from "../MspConnectionPairSolver/MspConnectionPairSolver";
import {
  SchematicTraceLinesSolver,
  type SolvedTracePath,
} from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver";
import { SameNetSegmentMergingSolver } from "lib/solvers/SameNetSegmentMergingSolver/SameNetSegmentMergingSolver";
import { TraceOverlapShiftSolver } from "../TraceOverlapShiftSolver/TraceOverlapShiftSolver";
import { NetLabelPlacementSolver } from "../NetLabelPlacementSolver/NetLabelPlacementSolver";
import { visualizeInputProblem } from "./visualizeInputProblem";
import { TraceLabelOverlapAvoidanceSolver } from "../TraceLabelOverlapAvoidanceSolver/TraceLabelOverlapAvoidanceSolver";
import { correctPinsInsideChips } from "./correctPinsInsideChip";
import { expandChipsToFitPins } from "./expandChipsToFitPins";
import { LongDistancePairSolver } from "../LongDistancePairSolver/LongDistancePairSolver";
import { MergedNetLabelObstacleSolver } from "../TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/LabelMergingSolver";
import { TraceCleanupSolver } from "../TraceCleanupSolver/TraceCleanupSolver";

type PipelineStep<T extends new (...args: any[]) => BaseSolver> = {
  solverName: string;
  solverClass: T;
  getConstructorParams: (
    instance: SchematicTracePipelineSolver,
  ) => ConstructorParameters<T>;
  onSolved?: (instance: SchematicTracePipelineSolver) => void;
  shouldSkip?: (instance: SchematicTracePipelineSolver) => boolean;
};

function definePipelineStep<
  T extends new (...args: any[]) => BaseSolver,
  const P extends ConstructorParameters<T>,
>(
  solverName: keyof SchematicTracePipelineSolver,
  solverClass: T,
  getConstructorParams: (instance: SchematicTracePipelineSolver) => P,
  opts: {
    onSolved?: (instance: SchematicTracePipelineSolver) => void;
    shouldSkip?: (instance: SchematicTracePipelineSolver) => boolean;
  } = {},
): PipelineStep<T> {
  return {
    solverName,
    solverClass,
    getConstructorParams,
    onSolved: opts.onSolved,
    shouldSkip: opts.shouldSkip,
  };
}

export interface SchematicTracePipelineSolverParams {
  inputProblem: InputProblem;
  allowLongDistanceTraces?: boolean;
}

export class SchematicTracePipelineSolver extends BaseSolver {
  mspConnectionPairSolver?: MspConnectionPairSolver;
  schematicTraceLinesSolver?: SchematicTraceLinesSolver;
  sameNetSegmentMergingSolver?: SameNetSegmentMergingSolver;
  longDistancePairSolver?: LongDistancePairSolver;
  traceOverlapShiftSolver?: TraceOverlapShiftSolver;
  netLabelPlacementSolver?: NetLabelPlacementSolver;
  labelMergingSolver?: MergedNetLabelObstacleSolver;
  traceLabelOverlapAvoidanceSolver?: TraceLabelOverlapAvoidanceSolver;
  traceCleanupSolver?: TraceCleanupSolver;

  startTimeOfPhase: Record<string, number>;
  endTimeOfPhase: Record<string, number>;
  timeSpentOnPhase: Record<string, number>;
  firstIterationOfPhase: Record<string, number>;

  inputProblem: InputProblem;

  pipelineDef = [
    // Step 1: MSP Connection Pair Solver
    definePipelineStep(
      "mspConnectionPairSolver",
      MspConnectionPairSolver,
      (instance) => [{ inputProblem: instance.inputProblem }],
      {
        onSolved: () => {},
      },
    ),

    // Step 2: Schematic Trace Lines Solver
    definePipelineStep(
      "schematicTraceLinesSolver",
      SchematicTraceLinesSolver,
      (instance) => [
        {
          mspConnectionPairs: instance.mspConnectionPairSolver!.mspConnectionPairs,
          dcConnMap: instance.mspConnectionPairSolver!.dcConnMap,
          globalConnMap: instance.mspConnectionPairSolver!.globalConnMap,
          inputProblem: instance.inputProblem,
          chipMap: instance.mspConnectionPairSolver!.chipMap,
        },
      ],
      {
        onSolved: () => {},
      },
    ),

    // Step 3: Same Net Segment Merging Solver
    definePipelineStep(
      "sameNetSegmentMergingSolver",
      SameNetSegmentMergingSolver,
      (instance) => [
        {
          solvedTracePaths: instance.schematicTraceLinesSolver!.solvedTracePaths,
          mergeThreshold: 0.5,
          alignThreshold: 0.5,
        },
      ],
      {
        onSolved: (instance) => {
          if (instance.sameNetSegmentMergingSolver?.mergedTracePaths) {
            instance.schematicTraceLinesSolver!.solvedTracePaths = instance
              .sameNetSegmentMergingSolver.mergedTracePaths as any;
          }
        },
      },
    ),

    // Step 4: Long Distance Pair Solver
    definePipelineStep(
      "longDistancePairSolver",
      LongDistancePairSolver,
      (instance) => [
        {
          inputProblem: instance.inputProblem,
          primaryMspConnectionPairs:
            instance.mspConnectionPairSolver!.mspConnectionPairs,
          alreadySolvedTraces:
            instance.schematicTraceLinesSolver!.solvedTracePaths,
        },
      ],
      {
        onSolved: () => {},
      },
    ),

    // Step 5: Trace Overlap Shift Solver
    definePipelineStep(
      "traceOverlapShiftSolver",
      TraceOverlapShiftSolver,
      (instance) => [
        {
          inputProblem: instance.inputProblem,
          inputTracePaths:
            instance.longDistancePairSolver!.getOutput().allTracesMerged,
          globalConnMap: instance.mspConnectionPairSolver!.globalConnMap,
        },
      ],
      {
        onSolved: () => {},
      },
    ),

    // Step 6: Net Label Placement Solver (First Pass)
    definePipelineStep(
      "netLabelPlacementSolver",
      NetLabelPlacementSolver,
      (instance) => [
        {
          inputProblem: instance.inputProblem,
          inputTraceMap:
            instance.traceOverlapShiftSolver?.correctedTraceMap ??
            Object.fromEntries(
              instance.longDistancePairSolver!.getOutput().allTracesMerged.map(
                (p) => [p.mspPairId, p],
              ),
            ),
        },
      ],
      {
        onSolved: () => {},
      },
    ),

    // Step 7: Trace Label Overlap Avoidance Solver
    definePipelineStep(
      "traceLabelOverlapAvoidanceSolver",
      TraceLabelOverlapAvoidanceSolver,
      (instance) => {
        const traceMap =
          instance.traceOverlapShiftSolver?.correctedTraceMap ??
          Object.fromEntries(
            instance
              .longDistancePairSolver!.getOutput()
              .allTracesMerged.map((p) => [p.mspPairId, p]),
          );
        const traces = Object.values(traceMap);
        const netLabelPlacements =
          instance.netLabelPlacementSolver!.netLabelPlacements;

        return [
          {
            inputProblem: instance.inputProblem,
            traces,
            netLabelPlacements,
          },
        ];
      },
      {
        onSolved: () => {},
      },
    ),

    // Step 8: Trace Cleanup Solver
    definePipelineStep(
      "traceCleanupSolver",
      TraceCleanupSolver,
      (instance) => {
        const prevSolverOutput =
          instance.traceLabelOverlapAvoidanceSolver!.getOutput();
        const traces = prevSolverOutput.traces;

        const labelMergingOutput =
          instance.traceLabelOverlapAvoidanceSolver!.labelMergingSolver!.getOutput();

        return [
          {
            inputProblem: instance.inputProblem,
            allTraces: traces,
            allLabelPlacements: labelMergingOutput.netLabelPlacements,
            mergedLabelNetIdMap: labelMergingOutput.mergedLabelNetIdMap,
            paddingBuffer: 0.1,
          },
        ];
      },
      {
        onSolved: () => {},
      },
    ),

    // Step 9: Net Label Placement Solver (Second Pass - Final)
    definePipelineStep(
      "netLabelPlacementSolver",
      NetLabelPlacementSolver,
      (instance) => {
        const traces =
          instance.traceCleanupSolver?.getOutput().traces ??
          instance.traceLabelOverlapAvoidanceSolver!.getOutput().traces;

        return [
          {
            inputProblem: instance.inputProblem,
            inputTraceMap: Object.fromEntries(
              traces.map((trace: SolvedTracePath) => [trace.mspPairId, trace]),
            ),
          },
        ];
      },
      {
        onSolved: () => {},
      },
    ),
  ];

  constructor(inputProblem: InputProblem) {
    super();
    this.inputProblem = this.cloneAndCorrectInputProblem(inputProblem);
    this.MAX_ITERATIONS = 1e6;
    this.startTimeOfPhase = {};
    this.endTimeOfPhase = {};
    this.timeSpentOnPhase = {};
    this.firstIterationOfPhase = {};
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SchematicTracePipelineSolver
  >[0] {
    return this.inputProblem;
  }

  currentPipelineStepIndex = 0;

  private cloneAndCorrectInputProblem(original: InputProblem): InputProblem {
    const cloned: InputProblem = structuredClone({
      ...original,
      _chipObstacleSpatialIndex: undefined,
    });

    expandChipsToFitPins(cloned);
    correctPinsInsideChips(cloned);

    return cloned;
  }

  override _step() {
    const pipelineStepDef = this.pipelineDef[this.currentPipelineStepIndex];
    if (!pipelineStepDef) {
      this.solved = true;
      return;
    }

    // Check if this step should be skipped
    if (pipelineStepDef.shouldSkip?.(this)) {
      this.currentPipelineStepIndex++;
      return;
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step();
      if (this.activeSubSolver.solved) {
        this.endTimeOfPhase[pipelineStepDef.solverName] = performance.now();
        this.timeSpentOnPhase[pipelineStepDef.solverName] =
          this.endTimeOfPhase[pipelineStepDef.solverName]! -
          this.startTimeOfPhase[pipelineStepDef.solverName]!;
        pipelineStepDef.onSolved?.(this);
        this.activeSubSolver = null;
        this.currentPipelineStepIndex++;
      } else if (this.activeSubSolver.failed) {
        this.error = this.activeSubSolver?.error;
        this.failed = true;
        this.activeSubSolver = null;
      }
      return;
    }

    // Lazy evaluation of constructor parameters - this is the key fix
    const constructorParams = pipelineStepDef.getConstructorParams(this);
    // @ts-ignore
    this.activeSubSolver = new pipelineStepDef.solverClass(...constructorParams);
    (this as any)[pipelineStepDef.solverName] = this.activeSubSolver;
    this.timeSpentOnPhase[pipelineStepDef.solverName] = 0;
    this.startTimeOfPhase[pipelineStepDef.solverName] = performance.now();
    this.firstIterationOfPhase[pipelineStepDef.solverName] = this.iterations;
  }

  solveUntilPhase(phase: string) {
    while (this.getCurrentPhase().toLowerCase() !== phase.toLowerCase()) {
      this.step();
    }
  }

  getCurrentPhase(): string {
    return (
      this.pipelineDef[this.currentPipelineStepIndex]?.solverName ?? "none"
    );
  }

  override visualize(): GraphicsObject {
    if (!this.solved && this.activeSubSolver)
      return this.activeSubSolver.visualize();

    const visualizations = [
      visualizeInputProblem(this.inputProblem),
      ...(this.pipelineDef
        .map((p) => (this as any)[p.solverName]?.visualize())
        .filter(Boolean)
        .map((viz, stepIndex) => {
          for (const rect of viz!.rects ?? []) {
            rect.step = stepIndex;
          }
          for (const point of viz!.points ?? []) {
            point.step = stepIndex;
          }
          for (const circle of viz!.circles ?? []) {
            circle.step = stepIndex;
          }
          for (const text of viz!.texts ?? []) {
            text.step = stepIndex;
          }
          for (const line of viz!.lines ?? []) {
            line.step = stepIndex;
          }
          return viz;
        }) as GraphicsObject[]),
    ];

    if (visualizations.length === 1) {
      return visualizations[0]!;
    }

    const finalGraphics = {
      points: visualizations.flatMap((v) => v.points || []),
      rects: visualizations.flatMap((v) => v.rects || []),
      lines: visualizations.flatMap((v) => v.lines || []),
      circles: visualizations.flatMap((v) => v.circles || []),
      texts: visualizations.flatMap((v) => v.texts || []),
    };
    return finalGraphics;
  }

  override preview(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.preview();
    }

    return super.preview();
  }
}