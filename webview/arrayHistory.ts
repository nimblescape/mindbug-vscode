// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The array history: the values that an array had at the earlier steps of the step history, for example the states of
// the array in the loop of a sort algorithm. The view shows them below the array when the switch "Show array history"
// is on. No DOM code here, so the unit tests can use it directly.

import type { MemorySnapshot, Value } from '../src/model.ts';
import { sameValue } from '../src/changes.ts';
import { topFrame } from './history.ts';

/** The most earlier states that the view shows below one array. */
export const MAX_ARRAY_STATES = 100;

/** The values of an array from one step on, until a later step changes them. */
export interface ArrayState {
  /** The number of the step where the array got these values. */
  step: number;
  /** The line where the program paused at that step. */
  line?: number;
  items: Value[];
  /** The real length of the array (`items` may be cut). */
  length: number;
  /** The number of items that are not read because of the limit `nimblescape.mindbug.maxArrayItems`. */
  more: number;
  /** The indexes of the cells that differ from the state before: a new value, or a cell that the array did not have. */
  changed: Set<number>;
}

function sameItems(a: ArrayState, items: Value[], length: number): boolean {
  return a.length === length && a.items.length === items.length && a.items.every((v, i) => sameValue(v, items[i]));
}

/**
 * The states of the array with id `id` in the steps `snaps`, the oldest first. A new state starts at each step where
 * the array has other values or another length than at the step before. A step that has not read the array (it did not
 * exist yet, or the object limit left it out) adds no state. The last state is the state of the last step that has the
 * array.
 */
export function arrayStates(snaps: readonly MemorySnapshot[], id: number): ArrayState[] {
  const states: ArrayState[] = [];
  for (const snap of snaps) {
    const o = snap.objects[id];
    if (!o || o.kind !== 'array') continue;
    const items = o.items ?? [];
    const length = o.length ?? items.length;
    const before = states[states.length - 1];
    if (before && sameItems(before, items, length)) continue;
    const changed = new Set<number>();
    if (before) {
      items.forEach((v, i) => {
        const old = before.items[i];
        if (!old || !sameValue(old, v)) changed.add(i);
      });
    }
    states.push({ step: snap.step, line: topFrame(snap)?.line, items, length, more: o.more ?? 0, changed });
  }
  return states;
}

/**
 * The earlier states of an array, for the rows below it: the states before its state at the last step of `snaps` (the
 * step that the view shows), the newest first, at most `max`. `hidden` is the number of older states that are left
 * out because of `max`.
 */
export function earlierStates(
  snaps: readonly MemorySnapshot[],
  id: number,
  max = MAX_ARRAY_STATES,
): { states: ArrayState[]; hidden: number } {
  const all = arrayStates(snaps, id);
  // The last state is the state that the array has at the shown step: the view draws it as the array itself.
  const earlier = all.slice(0, -1).reverse();
  return { states: earlier.slice(0, max), hidden: Math.max(0, earlier.length - max) };
}
