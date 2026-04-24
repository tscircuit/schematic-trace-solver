import type { Point } from "@tscircuit/math-utils"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"

export interface MovableSegment {
  start: Point;
  end: Point;
  freedom: "x+" | "x-" | "y+" | "y-";
  dir: { x: number; y: number };
}

const EPS = 1e-6; // numeric tolerance for equality
const MIN_LEN = 1e-6; // forbid near-zero length segments (adjacent collapses)

export const expandToUTurn = (elbow: Point[]): Point[] => {
  if (elbow.length !== 4) return elbow;

  const [start, p1, p2, end] = elbow;

  // Calculate overshoot distance from existing segments
  const overshoot = Math.max(
    Math.abs(start.x - p1.x),
    Math.abs(start.y - p1.y),
    0.2, // minimum overshoot
  );

  const startOrient = orientationOf(start, p1);
  const expanded: Point[] = [{ ...start }];

  if (startOrient === "horizontal") {
    const startDir = p1.x > start.x ? 1 : -1;
    expanded.push({ x: start.x + startDir * overshoot, y: start.y });

    // Move away vertically to create space for U-turn
    const verticalSpace = Math.max(
      overshoot * 2,
      Math.abs(end.y - start.y) + overshoot,
    );
    const midY =
      end.y > start.y ? start.y - verticalSpace : start.y + verticalSpace;

    expanded.push({ x: start.x + startDir * overshoot, y: midY });

    // Approach end from its required direction
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
    // Vertical start
    const startDir = p1.y > start.y ? 1 : -1;
    expanded.push({ x: start.x, y: start.y + startDir * overshoot });

    // Move away horizontally to create space for U-turn
    const horizontalSpace = Math.max(
      overshoot * 2,
      Math.abs(end.x - start.x) + overshoot,
    );
    const midX =
      end.x > start.x ? start.x - horizontalSpace : start.x + horizontalSpace;

    expanded.push({ x: midX, y: start.y + startDir * overshoot });

    // Approach end from its required direction
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

  // Determine facing directions from the path segments
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

  // Check if path overshoots and needs to turn back
  if (startFacing === "x+" && end.x < p1.x - EPS) return true;
  if (startFacing === "x-" && end.x > p1.x + EPS) return true;
  if (startFacing === "y+" && end.y < p1.y - EPS) return true;
  if (startFacing === "y-" && end.y > p1.y + EPS) return true;

  // Check if path segments conflict (p2 is past the end in the facing direction)
  if (endFacing === "x-" && p2.x > end.x + EPS && startFacing === "x+")
    return true;
  if (endFacing === "x+" && p2.x < end.x - EPS && startFacing === "x-")
    return true;
  if (endFacing === "y-" && p2.y > end.y + EPS && startFacing === "y+") {
    return true;
  }
  if (endFacing === "y+" && p2.y < end.y - EPS && startFacing === "y-") {
    return true;
  }

  return false;
}

// ... rest of the file remains unchanged ...