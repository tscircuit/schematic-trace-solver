
import type { InputProblem } from "lib/types/InputProblem";
import type { GraphicsObject, Line } from "graphics-debug";
import { minimizeTurnsWithFilteredLabels } from "./minimizeTurnsWithFilteredLabels";
import { balanceZShapes } from "./balanceZShapes";
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver";
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver";
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem";
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver";
import { UntangleTraceSubsolver } from "./sub-solver/UntangleTraceSubsolver";
import { is4PointRectangle } from "./is4PointRectangle";

interface TraceCleanupSolverInput {
	inputProblem: InputProblem;
	allTraces: SolvedTracePath[];
	allLabelPlacements: NetLabelPlacement[];
	mergedLabelNetIdMap: Record<string, Set<string>>;
	paddingBuffer: number;
}

type PipelineStep =
	| "minimizing_turns"
	| "balancing_l_shapes"
	| "untangling_traces";

export class TraceCleanupSolver extends BaseSolver {
	private input: TraceCleanupSolverInput;
	private outputTraces: SolvedTracePath[];
	private traceIdQueue: string[];
	private tracesMap: Map<string, SolvedTracePath>;
	private pipelineStep: PipelineStep = "untangling_traces";
	private activeTraceId: string | null = null;
	override activeSubSolver: BaseSolver | null = null;

	constructor(solverInput: TraceCleanupSolverInput) {
		super();
		this.input = solverInput;
		this.outputTraces = [...solverInput.allTraces];
		this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]));
		this.traceIdQueue = solverInput.allTraces.map((e) => e.mspPairId);
	}

	override _step() {
		if (this.activeSubSolver) {
			this.activeSubSolver.step();

			if (this.activeSubSolver.solved) {
				const output = (
					this.activeSubSolver as UntangleTraceSubsolver
				).getOutput();
				this.outputTraces = output.traces;
				this.tracesMap = new Map(this.outputTraces.map((t) => [t.mspPairId, t]));
				this.activeSubSolver = null;
				this.pipelineStep = "minimizing_turns";
			} else if (this.activeSubSolver.failed) {
				this.activeSubSolver = null;
				this.pipelineStep = "minimizing_turns";
			}
			return;
		}

		switch (this.pipelineStep) {
			case "untangling_traces":
				this._runUntangleTracesStep();
				break;
			case "minimizing_turns":
				this._runMinimizeTurnsStep();
				break;
			case "balancing_l_shapes":
				this._runBalanceLShapesStep();
				break;
		}
	}

	private _runUntangleTracesStep() {
		this.activeSubSolver = new UntangleTraceSubsolver({
			...this.input,
			allTraces: Array.from(this.tracesMap.values()),
		});
	}

	private _runMinimizeTurnsStep() {
		if (this.traceIdQueue.length === 0) {
			this.pipelineStep = "balancing_l_shapes";
			this.traceIdQueue = this.input.allTraces.map((e) => e.mspPairId);
			return;
		}
		this._processTrace("minimizing_turns");
	}

	private _runBalanceLShapesStep() {
		if (this.traceIdQueue.length === 0) {
			this._mergeNearbySameNetTraces();
			this.solved = true;
			return;
		}
		this._processTrace("balancing_l_shapes");
	}

	private _processTrace(step: "minimizing_turns" | "balancing_l_shapes") {
		const targetMspConnectionPairId = this.traceIdQueue.shift()!;
		this.activeTraceId = targetMspConnectionPairId;
		const originalTrace = this.tracesMap.get(targetMspConnectionPairId)!;

		if (is4PointRectangle(originalTrace.tracePath)) return;

		const allTraces = Array.from(this.tracesMap.values());
		let updatedTrace: SolvedTracePath;

		if (step === "minimizing_turns") {
			updatedTrace = minimizeTurnsWithFilteredLabels({
				...this.input,
				targetMspConnectionPairId,
				traces: allTraces,
			});
		} else {
			updatedTrace = balanceZShapes({
				...this.input,
				targetMspConnectionPairId,
				traces: allTraces,
			});
		}

		this.tracesMap.set(targetMspConnectionPairId, updatedTrace);
		this.outputTraces = Array.from(this.tracesMap.values());
	}

	private _mergeNearbySameNetTraces() {
		const threshold = 5;
		const traces = [...this.outputTraces];
		const merged: SolvedTracePath[] = [];
		const used = new Set<number>();

		const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
			Math.hypot(a.x - b.x, a.y - b.y);

		for (let i = 0; i < traces.length; i++) {
			if (used.has(i)) continue;
			let base = { ...traces[i] };

			for (let j = 0; j < traces.length; j++) {
				if (i === j || used.has(j)) continue;
				const other = traces[j];

				const sameNet =
					base.mspConnectionPairIds.some((id) =>
						other.mspConnectionPairIds.includes(id),
					) ||
					Object.values(this.input.mergedLabelNetIdMap).some(
						(netSet) =>
							base.mspConnectionPairIds.some((id) => netSet.has(id)) &&
							other.mspConnectionPairIds.some((id) => netSet.has(id)),
					);

				if (!sameNet) continue;

				const aEnd = base.tracePath.at(-1);
				const bStart = other.tracePath[0];
				const aStart = base.tracePath[0];
				const bEnd = other.tracePath.at(-1);

				if (!aEnd || !bStart || !aStart || !bEnd) continue;

				if (dist(aEnd, bStart) < threshold) {
					base.tracePath = [...base.tracePath, ...other.tracePath];
					base.mspConnectionPairIds = Array.from(
						new Set([
							...base.mspConnectionPairIds,
							...other.mspConnectionPairIds,
						]),
					);
					used.add(j);
				} else if (dist(aStart, bEnd) < threshold) {
					base.tracePath = [...other.tracePath, ...base.tracePath];
					base.mspConnectionPairIds = Array.from(
						new Set([
							...base.mspConnectionPairIds,
							...other.mspConnectionPairIds,
						]),
					);
					used.add(j);
				}
			}

			used.add(i);
			merged.push(base);
		}

		this.outputTraces = merged;
		this.tracesMap = new Map(merged.map((t) => [t.mspPairId, t]));
	}

	getOutput() {
		return { traces: this.outputTraces };
	}

	override visualize(): GraphicsObject {
		if (this.activeSubSolver) return this.activeSubSolver.visualize();

		const graphics = visualizeInputProblem(this.input.inputProblem, {
			chipAlpha: 0.1,
			connectionAlpha: 0.1,
		});

		if (!graphics.lines) graphics.lines = [];

		for (const trace of this.outputTraces) {
			const line: Line = {
				points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
				strokeColor: trace.mspPairId === this.activeTraceId ? "red" : "blue",
			};
			graphics.lines.push(line);
		}
		return graphics;
	}
}
