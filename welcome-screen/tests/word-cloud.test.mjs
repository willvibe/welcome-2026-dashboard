import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutWords } from '../lib/word-cloud-layout.mjs';

const stats = JSON.parse(
  readFileSync(new URL('../lib/initial-stats.json', import.meta.url), 'utf8'),
);
for (const [key, names] of [
  ['nameWords', true],
  ['hobbyWords', false],
]) {
  test(`${key}: all labels fit without collisions across dashboard proportions`, () => {
    for (const [width, height] of [
      [260, 155],
      [320, 220],
      [400, 340],
      [500, 190],
      [240, 380],
    ]) {
      const packed = layoutWords(stats[key], names, width, height);
      assert.equal(packed.length, stats[key].length);
      assert.deepEqual(
        new Map(packed.map((w) => [w.name, w.value])),
        new Map(stats[key].map((w) => [w.name, w.value])),
      );
      for (const word of packed) {
        assert.ok(word.size > 0 && Number.isFinite(word.size));
        assert.ok(
          word.x - word.width / 2 >= -0.01 &&
            word.x + word.width / 2 <= width + 0.01,
          word.name,
        );
        assert.ok(
          word.y - word.height / 2 >= -0.01 &&
            word.y + word.height / 2 <= height + 0.01,
          word.name,
        );
      }
      for (let i = 0; i < packed.length; i++)
        for (let j = i + 1; j < packed.length; j++) {
          const a = packed[i],
            b = packed[j];
          assert.ok(
            Math.abs(a.x - b.x) + 0.01 >= (a.width + b.width) / 2 ||
              Math.abs(a.y - b.y) + 0.01 >= (a.height + b.height) / 2,
            `${a.name} overlaps ${b.name}`,
          );
        }
      // A resized canvas must use both axes, rather than retaining a small fixed central cloud.
      const spanX =
        Math.max(...packed.map((w) => w.x + w.width / 2)) -
        Math.min(...packed.map((w) => w.x - w.width / 2));
      const spanY =
        Math.max(...packed.map((w) => w.y + w.height / 2)) -
        Math.min(...packed.map((w) => w.y - w.height / 2));
      assert.ok(
        spanX > width * 0.7 && spanY > height * 0.7,
        `${width}×${height} unused space`,
      );
    }
  });
}
test('word clouds retain placement when an equivalent snapshot arrives', () => {
  assert.deepEqual(
    layoutWords(stats.nameWords, true, 340, 250),
    layoutWords([...stats.nameWords].reverse(), true, 340, 250),
  );
  assert.deepEqual(layoutWords([], false, 340, 250), []);
});
