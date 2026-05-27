const p1 = { x: 1.015, y: 2 };
const next1 = { x: 1.015, y: 3 };
const p2 = { x: 1.015, y: 5 };
const next2 = { x: 1.015, y: 6 };

function isVertical(p, next) {
  return next && Math.abs(p.x - next.x) < 1e-6 && Math.abs(p.y - next.y) > 1e-6;
}

console.log("Logic Check:", isVertical(p1, next1) && isVertical(p2, next2));
