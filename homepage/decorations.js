// Trees, flowers, weeds and rocks on the empty cells of each land (pure function).
// Choices are hashed from the category and the cell's place inside its land, so they stay
// put across renders and move along when the whole land moves. The picket cell stays empty.

import { hashText } from "./layout.js";

const PROPS = "../assets/Isometric City/Props";
const TREES = ["tree_common_large", "tree_common_medium", "tree_pine_medium", "tree_pine_small", "tree_pine_tall"];
const SMALL = [
    "flowers_pink",
    "flowers_red",
    "flowers_yellow",
    "weed_large_a",
    "weed_large_b",
    "weed_medium",
    "weed_small",
    "rocks_brown_a",
    "rocks_brown_b",
    "rocks_gray_a",
    "rocks_gray_c",
];
const EMPTY_SHARE = 0.15; // cells left bare
const TREE_SHARE = 0.3; // cells with one tree; the rest get one to three small props

/**
 * @param {{category: {id: string}, area: {x:number,y:number,w:number,h:number}, cells: Map, picket: {x:number,y:number}|null}} group
 * @returns {{x: number, y: number, src: string}[]} grid points where each prop stands
 */
export function decorationsFor({ category, area, cells, picket }) {
    const taken = new Set([...cells.values()].map((cell) => `${cell.x},${cell.y}`));
    if (picket) taken.add(`${picket.x},${picket.y}`);
    const props = [];
    for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
            if (taken.has(`${x},${y}`)) continue;
            // Several numbers from one cell: hash the key with a running index.
            const key = `${category.id}:${x - area.x},${y - area.y}`;
            let index = 0;
            const roll = () => hashText(`${key}:${index++}`) / 4294967296;
            const kind = roll();
            if (kind < EMPTY_SHARE) continue;
            if (kind < EMPTY_SHARE + TREE_SHARE) {
                const name = TREES[Math.floor(roll() * TREES.length)];
                props.push({ x: x + 0.5, y: y + 0.5, src: `${PROPS}/prop_${name}.png` });
                continue;
            }
            const count = 1 + Math.floor(roll() * 3);
            for (let i = 0; i < count; i++) {
                const name = SMALL[Math.floor(roll() * SMALL.length)];
                props.push({ x: x + 0.2 + roll() * 0.6, y: y + 0.2 + roll() * 0.6, src: `${PROPS}/prop_${name}.png` });
            }
        }
    }
    return props;
}
