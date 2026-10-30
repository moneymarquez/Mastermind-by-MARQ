import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression (Oct 30 2026): tapping Guided start on the Clients board made
// the board flash. Screens are lazy chunks inside one Suspense boundary, so
// a plain screen change hid the board behind the loading skeleton while the
// Start chunk downloaded, then the Start screen swapped in its own Loading
// page before its content.
test('navigating to a screen is a transition, so the current screen stays up until the next is ready', () => {
  const src = readFileSync('src/state.ts', 'utf8');
  const nav = src.slice(src.indexOf('const navigateTo = '), src.indexOf('const onCirclePointerDown'));
  assert.match(nav, /startTransition\(\(\) => patch\(\{ screen: id as Screen \}\)\)/);
  assert.doesNotMatch(nav, /patch\(\{ screen: id as Screen, navDrawerOpen: false \}\)/);
});

test('Start screen keeps its page up while projects load instead of swapping in a Loading page', () => {
  const src = readFileSync('src/components/screens/ScalingStartScreen.tsx', 'utf8');
  assert.doesNotMatch(src, /if \(loading\) return <Page/);
  assert.match(src, /Loading projects…/);
});
