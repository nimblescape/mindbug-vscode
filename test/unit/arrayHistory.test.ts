// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { arrayStates, earlierStates } from '../../webview/arrayHistory.ts';
import type { HeapObject, MemorySnapshot, Value } from '../../src/model.ts';

const num = (n: number): Value => ({ k: 'num', v: String(n) });

/** A step that paused at `line` with the array id 7 holding `values` (no array for `undefined`). */
function snap(step: number, values: number[] | undefined, extra: Partial<HeapObject> = {}, line = 10 + step): MemorySnapshot {
  const objects: Record<number, HeapObject> = {};
  if (values) objects[7] = { id: 7, kind: 'array', type: 'Array', items: values.map(num), length: values.length, ...extra };
  return {
    step,
    frames: [{ frameId: 0, name: 'Global scope', isGlobal: true, line, file: '/w/sort.ts', vars: [] }],
    objects,
    missing: [],
  };
}

const texts = (items: Value[]) => items.map((v) => (v.k === 'num' ? v.v : v.k)).join(' ');

test('a new state starts only at a step that changed the array', () => {
  const states = arrayStates([snap(1, [3, 1, 2]), snap(2, [3, 1, 2]), snap(3, [3, 3, 2]), snap(4, [3, 3, 2]), snap(5, [1, 3, 2])], 7);
  assert.deepEqual(
    states.map((s) => [s.step, s.line, texts(s.items)]),
    [
      [1, 11, '3 1 2'],
      [3, 13, '3 3 2'],
      [5, 15, '1 3 2'],
    ],
  );
});

test('marks the cells that the step changed, and the new cells of a longer array', () => {
  const states = arrayStates([snap(1, [3, 1]), snap(2, [3, 3]), snap(3, [3, 3, 9])], 7);
  assert.deepEqual(
    states.map((s) => [...s.changed]),
    [[], [1], [2]],
  );
});

test('a shorter array is a new state, without a changed cell', () => {
  const states = arrayStates([snap(1, [3, 1, 2]), snap(2, [3, 1])], 7);
  assert.equal(states.length, 2);
  assert.deepEqual([...states[1].changed], []);
  assert.equal(states[1].length, 2);
});

test('a step without the array adds no state, and the array before it continues', () => {
  const states = arrayStates([snap(1, undefined), snap(2, [1, 2]), snap(3, undefined), snap(4, [1, 2]), snap(5, [2, 2])], 7);
  assert.deepEqual(
    states.map((s) => s.step),
    [2, 5],
  );
});

test('a change of the real length of a cut array is a new state', () => {
  const states = arrayStates([snap(1, [1, 2], { length: 5, more: 3 }), snap(2, [1, 2], { length: 6, more: 4 })], 7);
  assert.equal(states.length, 2);
  assert.equal(states[1].more, 4);
});

test('the earlier states leave out the state of the shown step and have the newest first', () => {
  const steps = [snap(1, [3, 1, 2]), snap(2, [3, 3, 2]), snap(3, [1, 3, 2]), snap(4, [1, 3, 2])];
  const { states, hidden } = earlierStates(steps, 7);
  assert.deepEqual(
    states.map((s) => s.step),
    [2, 1],
  );
  assert.equal(hidden, 0);
});

test('an array that never changed has no earlier state', () => {
  assert.deepEqual(earlierStates([snap(1, [1]), snap(2, [1])], 7).states, []);
  assert.deepEqual(earlierStates([snap(1, undefined)], 7).states, []);
});

test('an array that gets its old values again shows the states in between', () => {
  const { states } = earlierStates([snap(1, [1, 2]), snap(2, [2, 1]), snap(3, [1, 2])], 7);
  assert.deepEqual(
    states.map((s) => [s.step, texts(s.items)]),
    [
      [2, '2 1'],
      [1, '1 2'],
    ],
  );
});

test('keeps at most `max` earlier states, the newest, and counts the older ones', () => {
  const steps = Array.from({ length: 8 }, (_, i) => snap(i + 1, [i]));
  const { states, hidden } = earlierStates(steps, 7, 3);
  assert.deepEqual(
    states.map((s) => s.step),
    [7, 6, 5],
  );
  assert.equal(hidden, 4);
});
