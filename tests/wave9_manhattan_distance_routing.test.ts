import test from "ava";

test("Wave 9 Olympus: Manhattan distance heuristic calculation", (t) => {
  const getManhattanDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
  };

  const start = { x: 0, y: 0 };
  const target = { x: 10, y: 25 };

  t.is(getManhattanDistance(start, target), 35);
  t.is(getManhattanDistance({ x: -5, y: 10 }, { x: 5, y: 20 }), 20);
});

test("Wave 9 Olympus: Minimum trace clearance boundary evaluation", (t) => {
  const isClearanceSafe = (distanceMm: number, minClearanceMm: number = 0.2): boolean => {
    return distanceMm >= minClearanceMm;
  };

  t.true(isClearanceSafe(0.25));
  t.true(isClearanceSafe(0.20));
  t.false(isClearanceSafe(0.15));
});
