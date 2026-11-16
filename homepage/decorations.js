// Trees, flowers, weeds, rocks and street furniture on the empty cells of each land, and front
// yards (a fence and a mailbox) for houses (pure functions).
// Choices are hashed from the category and the cell's place inside its land, so they stay
// put across renders and move along when the whole land moves. The picket cell stays empty.
// Props are drawn at their original size: scaling pixel art makes its pixels look uneven.

import { hashText } from "./layout.js";

const PROPS = "../assets/Isometric City/Props";
// All five trees; the smaller two are listed twice so the big ones stay occasional.
const TREES = [
    "tree_common_medium",
    "tree_common_medium",
    "tree_pine_small",
    "tree_pine_small",
    "tree_common_large",
    "tree_pine_medium",
    "tree_pine_tall",
];
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
const TREE_SHARE = 0.25; // cells with a tree and a plant or two in front of it
const FURNITURE_SHARE = 0.15; // cells with one piece of street furniture and a plant or two
const YARD_SHARE = 0.7; // houses with a front fence and a mailbox
// Fence sprites run along the x axis ("\" on screen); mirrored they run along the y axis. Their base line sits
// lower in the image than a standing prop's feet.
const FENCES = ["fence_wood_a", "fence_wood_b"];
const FENCE_ANCHOR = 0.7;

// Several pseudo-random numbers in [0, 1) from one key.
function roller(key) {
    let index = 0;
    return () => hashText(`${key}:${index++}`) / 4294967296;
}
const pick = (list, roll) => list[Math.floor(roll() * list.length)];
const prop = (name, x, y, extra = {}) => ({ x, y, src: `${PROPS}/prop_${name}.png`, ...extra });

/**
 * @param {{category: {id: string}, area: {x:number,y:number,w:number,h:number}, cells: Map, picket: {x:number,y:number}|null}} group
 * @returns {{x: number, y: number, src: string, flip?: boolean, anchor?: number}[]} grid points where each prop stands
 */
export function decorationsFor({ category, area, cells, picket }) {
    const taken = new Set([...cells.values()].map((cell) => `${cell.x},${cell.y}`));
    if (picket) taken.add(`${picket.x},${picket.y}`);
    const props = [];
    for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
            if (taken.has(`${x},${y}`)) continue;
            const roll = roller(`${category.id}:${x - area.x},${y - area.y}`);
            const at = (from, to) => from + roll() * (to - from);
            const cell = [];
            const kind = roll();
            if (kind < TREE_SHARE + FURNITURE_SHARE) {
                cell.push(prop(pick(kind < TREE_SHARE ? TREES : FURNITURE, roll), x + at(0.4, 0.6), y + at(0.4, 0.6)));
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
 * Front yard of a house standing on `cell`: a fence along one front edge and a mailbox on the
 * other, or nothing for some houses.
 * @returns {{x: number, y: number, src: string, flip?: boolean, anchor?: number}[]}
 */
export function yardFor(bookmarkId, cell) {
    const roll = roller(`yard:${bookmarkId}`);
    if (roll() >= YARD_SHARE) return [];
    const fence = pick(FENCES, roll);
    const mailbox = pick(["dropbox_a", "dropbox_b"], roll);
    const { x, y } = cell;
    // Front edges: y = y+1 (lower left) and x = x+1 (lower right). The fence stands toward the
    // outer corner and the mailbox toward the back of the other edge, clear of the name label
    // under the front corner.
    return roll() < 0.5
        ? [prop(fence, x + 0.3, y + 0.97, { anchor: FENCE_ANCHOR }), prop(mailbox, x + 0.95, y + 0.3)]
        : [prop(fence, x + 0.97, y + 0.3, { anchor: FENCE_ANCHOR, flip: true }), prop(mailbox, x + 0.3, y + 0.95)];
}
