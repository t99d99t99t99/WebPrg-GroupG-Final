// Flowers, weeds, rocks, trees and street furniture on the empty cells of each land, and front
// yards (a fence and a mailbox) for houses (pure functions). The "지도 장식 밀도" setting picks
// how much of each (DENSITIES).
// Choices are hashed from the category and the cell's place inside its land, so they stay
// put across renders and move along when the whole land moves. The picket cell stays empty.
// Props are drawn at their original size: scaling pixel art makes its pixels look uneven.

import { hashText } from "./layout.js";

const PROPS = "../assets/Isometric City/Props";
// Only the smaller trees: the large ones looked like buildings in the beta test.
const SMALL_TREES = ["tree_pine_small", "tree_common_medium"];
const BIG_TREES = ["tree_pine_medium"];
const FURNITURE = ["lightpole_a", "lightpole_b", "trashcan_blue_a", "trashcan_green_b", "dropbox_a", "dropbox_b"];
const FLOWERS = ["flowers_pink", "flowers_red", "flowers_yellow"];
const PLANTS = [
    ...FLOWERS,
    "weed_large_a",
    "weed_large_b",
    "weed_medium",
    "weed_small",
    "rocks_brown_a",
    "rocks_brown_c",
    "rocks_gray_a",
    "rocks_gray_b",
];
// What each "지도 장식 밀도" shows:
// - low: a few flowers, weeds and rocks, leaving most of the land empty.
// - normal: more of them, a small tree or a piece of street furniture (street light, trash can,
//   postbox) here and there, and a fence by some houses.
// - high: every empty cell, with small and big trees, street furniture, and a fence by most houses.
// `share` is the share of empty cells that get anything; `tree` and `furniture` are the shares of
// those cells that get a tree or a piece of street furniture (with a plant or two in front); `yard` is the share of
// houses with a front fence and a mailbox. Each cell keeps its own fixed rolls, so a higher density
// decorates every cell a lower one does and adds more.
const DENSITIES = {
    low: { share: 0.35, trees: [], tree: 0, furniture: 0, yard: 0 },
    normal: { share: 0.65, trees: SMALL_TREES, tree: 0.15, furniture: 0.1, yard: 0.4 },
    high: { share: 1, trees: [...SMALL_TREES, ...SMALL_TREES, ...BIG_TREES], tree: 0.25, furniture: 0.15, yard: 0.8 },
};
// A fence stands on the house's front edge (lower left on screen), parallel to the door side.
// fence_wood_a is drawn in that direction and fence_wood_b in the other, so b is mirrored.
// `anchor` is where the bottom of the posts meets the ground under the middle of the image, and
// `shift` (cells along the edge) centres the drawn part, as each image has empty columns on one side.
const FENCES = [
    { name: "fence_wood_a", flip: false, anchor: 0.82, shift: 0.07 },
    { name: "fence_wood_b", flip: true, anchor: 0.71, shift: -0.055 },
];

// Several pseudo-random numbers in [0, 1) from one key.
function roller(key) {
    let index = 0;
    return () => hashText(`${key}:${index++}`) / 4294967296;
}
const pick = (list, roll) => list[Math.floor(roll() * list.length)];
const prop = (name, x, y, extra = {}) => ({ x, y, src: `${PROPS}/prop_${name}.png`, ...extra });

/**
 * @param {{category: {id: string}, area: {x:number,y:number,w:number,h:number}, cells: Map, picket: {x:number,y:number}|null}} group
 * @param {"low"|"normal"|"high"} [density]
 * @returns {{x: number, y: number, src: string, flip?: boolean, anchor?: number}[]} grid points where each prop stands
 */
export function decorationsFor({ category, area, cells, picket }, density = "high") {
    const { share, trees, tree, furniture } = DENSITIES[density] ?? DENSITIES.high;
    const taken = new Set([...cells.values()].map((cell) => `${cell.x},${cell.y}`));
    if (picket) taken.add(`${picket.x},${picket.y}`);
    const props = [];
    for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
            if (taken.has(`${x},${y}`)) continue;
            // A separate roll from the one choosing what grows here, so the choices stay the same.
            if (hashText(`density:${category.id}:${x - area.x},${y - area.y}`) / 4294967296 >= share) continue;
            const roll = roller(`${category.id}:${x - area.x},${y - area.y}`);
            const at = (from, to) => from + roll() * (to - from);
            const cell = [];
            const kind = roll();
            if (kind < tree + furniture) {
                cell.push(prop(pick(kind < tree ? trees : FURNITURE, roll), x + at(0.4, 0.6), y + at(0.4, 0.6)));
                const extra = 1 + Math.floor(roll() * 2);
                for (let i = 0; i < extra; i++)
                    cell.push(prop(pick(PLANTS, roll), x + at(0.65, 0.9), y + at(0.65, 0.9)));
            } else {
                // One or two clumps of the same plant, so small flowers read as a flower bed.
                const clumps = 1 + Math.floor(roll() * 2);
                for (let c = 0; c < clumps; c++) {
                    const name = pick(PLANTS, roll);
                    const [cx, cy] = [at(0.25, 0.75), at(0.25, 0.75)];
                    const size = FLOWERS.includes(name) ? 3 + Math.floor(roll() * 3) : 1 + Math.floor(roll() * 2);
                    for (let i = 0; i < size; i++)
                        cell.push(prop(name, x + cx + at(-0.13, 0.13), y + cy + at(-0.13, 0.13)));
                }
            }
            // Same depth inside a cell: draw back to front.
            props.push(...cell.sort((a, b) => a.x + a.y - (b.x + b.y)));
        }
    }
    return props;
}

/**
 * Front yard of a house standing on `cell`: a fence on its front edge and a mailbox on its side
 * edge, or nothing for some houses (none at all on the low density).
 * @param {"low"|"normal"|"high"} [density]
 * @returns {{x: number, y: number, src: string, flip?: boolean, anchor?: number}[]}
 */
export function yardFor(bookmarkId, cell, density = "high") {
    const roll = roller(`yard:${bookmarkId}`);
    if (roll() >= (DENSITIES[density] ?? DENSITIES.high).yard) return [];
    const fence = pick(FENCES, roll);
    const mailbox = pick(["dropbox_a", "dropbox_b"], roll);
    const { x, y } = cell;
    // Front edge y = y+1 (lower left), toward its outer end so the name label under the front
    // corner stays clear; the mailbox stands toward the back of the side edge x = x+1.
    return [
        prop(fence.name, x + 0.4 + fence.shift, y + 0.98, { anchor: fence.anchor, flip: fence.flip }),
        prop(mailbox, x + 0.95, y + 0.3),
    ];
}
