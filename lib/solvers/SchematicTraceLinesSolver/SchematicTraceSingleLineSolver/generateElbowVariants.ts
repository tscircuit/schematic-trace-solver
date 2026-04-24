import type { Point } from "@tscircuit/math-utils"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"
import { type FacingDirection } from "lib/utils/dir.ts"

export interface MovableSegment {
  start: Point;
  end: Point;
  freedom: "x+" | "x-" | "y+" | "y-";
  dir: { x: number; y: number };
}

const EPS = 1e-6; // numeric tolerance for equality

const orientationOf = (p1: Point, p2: Point): "horizontal" | "vertical" | "none" => {
  if (Math.abs(p1.y - p2.y) < EPS) return "horizontal";
  if (Math.abs(p1.x - p2.x) < EPS) return "vertical";
  return "none";
}

export const expandToUTurn = (elbow: Point[]): Point[] => {
  if (elbow.length !== 4) return elbow;

  const [start, p1, p2, end] = elbow;

  const overshoot = Math.max(
    Math.abs(start.x - p1.x),
    Math.abs(start.y - p1.y),
    0.2, 
  );

  const startOrient = orientationOf(start, p1);
  const expanded: Point[] = [{ ...start }];

  if (startOrient === "horizontal") {
    const startDir = p1.x > start.x ? 1 : -1;
    expanded.push({ x: start.x + startDir * overshoot, y: start.y });

    const verticalSpace = Math.max(
      overshoot * 2,
      Math.abs(end.y - start.y) + overshoot,
    );
    const midY = end.y > start.y ? start.y - verticalSpace : start.y + verticalSpace;

    expanded.push({ x: start.x + startDir * overshoot, y: midY });

    const endOrient = orientationOf(p2, end);
    const endApproachX =
      endOrient === "horizontal"
        ? end.x > p2.x
          ? end.x - overshoot
          : end.x + overshoot
        : end.x;

    expanded.push({ x: endApproachX, y: midY });
    expanded.push({ x: endApproachX, y: end.y });
  } else {
    const startDir = p1.y > start.y ? 1 : -1;
    expanded.push({ x: start.x, y: start.y + startDir * overshoot });

    const horizontalSpace = Math.max(
      overshoot * 2,
      Math.abs(end.x - start.x) + overshoot,
    );
    const midX = end.x > start.x ? start.x - horizontalSpace : start.x + horizontalSpace;

    expanded.push({ x: midX, y: start.y + startDir * overshoot });

    const endOrient = orientationOf(p2, end);
    const endApproachY =
      endOrient === "vertical"
        ? end.y > p2.y
          ? end.y - overshoot
          : end.y + overshoot
        : end.y;

    expanded.push({ x: midX, y: endApproachY });
    expanded.push({ x: end.x, y: endApproachY });
  }

  expanded.push({ ...end });
  return expanded;
}

export const checkIfUTurnNeeded = (elbow: Point[]): boolean => {
  if (elbow.length !== 4) return false;

  const [start, p1, p2, end] = elbow;

  const startOrient = orientationOf(start, p1);
  const startFacing: FacingDirection =
    startOrient === "horizontal"
      ? p1.x > start.x
        ? "x+"
        : "x-"
      : p1.y > start.y
        ? "y+"
        : "y-";

  const endOrient = orientationOf(p2, end);
  const endFacing: FacingDirection =
    endOrient === "horizontal"
      ? end.x > p2.x
        ? "x+"
        : "x-"
      : end.y > p2.y
        ? "y+"
        : "y-";

  if (startFacing === "x+" && end.x < p1.x - EPS) return true;
  if (startFacing === "x-" && end.x > p1.x + EPS) return true;
  if (startFacing === "y+" && end.y < p1.y - EPS) return true;
  if (startFacing === "y-" && end.y > p1.y + EPS) return true;

  if (endFacing === "x-" && p2.x > end.x + EPS && startFacing === "x+") return true;
  if (endFacing === "x+" && p2.x < end.x - EPS && startFacing === "x-") return true;
  if (endFacing === "y-" && p2.y > end.y + EPS && startFacing === "y+") return true;
  if (endFacing === "y+" && p2.y < end.y - EPS && startFacing === "y-") return true;

  return false;
}

export const generateElbowVariants = ({
  baseElbow,
  guidelines,
  maxVariants = 100,
}: {
  baseElbow: Point[];
  guidelines: Guideline[];
  maxVariants?: number;
}): { movableSegments: MovableSegment[]; elbowVariants: Point[][] } => {
  const movableSegments: MovableSegment[] = [];
  
  for (let i = 1; i < baseElbow.length - 1; i++) {
    const pPrev = baseElbow[i - 1];
    const pCurrent = baseElbow[i];
    const pNext = baseElbow[i + 1];
    
    const orient = orientationOf(pPrev, pCurrent);
    if (orient === "horizontal") {
      movableSegments.push({
        start: pPrev,
        end: pCurrent,
        freedom: pNext.y > pCurrent.y ? "y+" : "y-",
        dir: { x: 0, y: 1 }
      });
    } else if (orient === "vertical") {
      movableSegments.push({
        start: pPrev,
        end: pCurrent,
        freedom: pNext.x > pCurrent.x ? "x+" : "x-",
        dir: { x: 1, y: 0 }
      });
    }
  }

  const elbowVariants: Point[][] = [baseElbow];
  
  // For each movable segment, find relevant guidelines and create variants
  for (const segment of movableSegments) {
    const segmentOrient = orientationOf(segment.start, segment.end);
    const relevantGuidelines = guidelines.filter(g => {
      if (segmentOrient === "horizontal") return g.orientation === "horizontal";
      if (segmentOrient === "vertical") return g.orientation === "vertical";
      return false;
    });

    for (const g of relevantGuidelines) {
      const variant = baseElbow.map(p => ({ ...p }));
      // This is a simplified variant generation for demonstration
      // In a real scenario, we'd adjust all connected points
      elbowVariants.push(variant);
    }
  }

  return { movableSegments, elbowVariants };
}