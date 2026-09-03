/**
 * Assertion for src/lib/projection.ts (plan §4).
 *
 * The projection is only correct if it reproduces the three positions the
 * design published. Run it:
 *
 *   node --experimental-strip-types src/lib/projection.check.mjs
 *
 * (The flag is a no-op on Node >= 23.6, where type stripping is on by
 * default; it is required on the Node 22.12 floor in package.json. This is a
 * plain .mjs script on purpose — no test runner is added as a dependency.)
 *
 * Exits non-zero on any mismatch.
 */
import assert from 'node:assert/strict';
import { project } from './projection.ts';

/** lon, lat -> the percentages hardcoded in design/Barbechero Sitio.dc.html. */
const CASES = [
  { name: 'espadin-mexicano', coords: [-99.55, 18.35], expected: [38.9, 44.9] },
  { name: 'cupreata', coords: [-99.3, 17.95], expected: [40.4, 51.1] },
  { name: 'coyote', coords: [-96.55, 16.3], expected: [57.5, 76.3] },
];

const round1 = (n) => Math.round(n * 10) / 10;

let failed = 0;
for (const { name, coords, expected } of CASES) {
  const { x, y } = project(coords);
  const got = [round1(x), round1(y)];
  const ok = got[0] === expected[0] && got[1] === expected[1];
  if (!ok) failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(17)} ` +
      `[${coords[0]}, ${coords[1]}]  ->  ${x.toFixed(3)}%, ${y.toFixed(3)}%  ` +
      `(${got[0]}%, ${got[1]}%)  expected ${expected[0]}%, ${expected[1]}%`,
  );
}

assert.equal(failed, 0, `${failed} projection case(s) did not match the design.`);
console.log(`\nAll ${CASES.length} published positions reproduced to one decimal place.`);
