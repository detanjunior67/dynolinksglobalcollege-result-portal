const assert = require('node:assert/strict');
const { evaluateScientificExpression } = require('../public/scientific-calculator.js');

const approx = (actual, expected, tolerance = 1e-9) => {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
};

const tests = [
  () => approx(evaluateScientificExpression('sin(30)', 'deg'), 0.5),
  () => approx(evaluateScientificExpression('cos(60)', 'deg'), 0.5),
  () => approx(evaluateScientificExpression('sqrt(81)'), 9),
  () => approx(evaluateScientificExpression('2^3'), 8),
  () => approx(evaluateScientificExpression('10 + 5 * 2'), 20),
];

for (const [index, test] of tests.entries()) {
  try {
    test();
  } catch (error) {
    console.error(`Calculator test ${index + 1} failed: ${error.message}`);
    process.exit(1);
  }
}

console.log(`Scientific calculator tests passed: ${tests.length}`);
