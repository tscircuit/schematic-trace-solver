import test from "ava";

interface Point {
  x: number;
  y: number;
}

interface TracePath {
  points: Point[];
  bendPenalty: number;
  unitLengthCost: number;
}

const computePathCost = (path: TracePath): number => {
  if (path.points.length < 2) return 0;
  let totalLength = 0;
  let bendCount = 0;

  for (let i = 1; i < path.points.length; i++) {
    const p1 = path.points[i - 1];
    const p2 = path.points[i];
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    totalLength += (dx + dy);

    if (i > 1) {
      const p0 = path.points[i - 2];
      const prevDir = p1.x !== p0.x ? 'horizontal' : 'vertical';
      const curDir = p2.x !== p1.x ? 'horizontal' : 'vertical';
      if (prevDir !== curDir) {
        bendCount++;
      }
    }
  }

  return (totalLength * path.unitLengthCost) + (bendCount * path.bendPenalty);
};

test("Wave 17 Eclipse: Orthogonal path routing cost calculation with bend penalties", (t) => {
  // Straight path: (0,0) -> (10,0) (length=10, bends=0)
  const straightPath: TracePath = {
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    bendPenalty: 5,
    unitLengthCost: 1
  };
  t.is(computePathCost(straightPath), 10);

  // L-path: (0,0) -> (5,0) -> (5,5) (length=10, bends=1)
  const lPath: TracePath = {
    points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }],
    bendPenalty: 5,
    unitLengthCost: 1
  };
  t.is(computePathCost(lPath), 15); // 10 length + 5 penalty

  // Z-path: (0,0) -> (5,0) -> (5,5) -> (10,5) (length=15, bends=2)
  const zPath: TracePath = {
    points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 5 }],
    bendPenalty: 5,
    unitLengthCost: 1
  };
  t.is(computePathCost(zPath), 25); // 15 length + 10 penalty
});
