// Stable slots depend on category order and order within the saved array.
// Appending a bookmark never changes the coordinates of an existing building.
export const layouts = [
    {
        x: 640,
        y: 617,
        floor: "study",
        color: "#a6bce9",
        label: [285, -18],
        slots: [
            [210, 98],
            [325, 95],
        ],
    },
    {
        x: 250,
        y: 423,
        floor: "tools",
        color: "#6aab92",
        label: [50, 16],
        slots: [
            [145, 146],
            [255, 188],
        ],
    },
    {
        x: 159,
        y: 764,
        floor: "favorites",
        color: "#e78674",
        label: [0, 20],
        slots: [
            [200, 164],
            [295, 119],
        ],
    },
    {
        x: 787,
        y: 871,
        floor: "google",
        color: "#e9b962",
        label: [380, 0],
        slots: [
            [165, 122],
            [270, 169],
        ],
    },
];

export function getLayout(index) {
    if (index < layouts.length) return layouts[index];
    const offset = index - layouts.length;
    return {
        x: 140 + (offset % 2) * 630,
        y: 1050 + Math.floor(offset / 2) * 200,
        floor: "study",
        color: "#a5bcb5",
        label: [0, 0],
        slots: [
            [120, 90],
            [250, 90],
        ],
    };
}

export function getPosition(layout, slot) {
    const point = layout.slots[slot] ?? [425 + ((slot - 2) % 3) * 95, 100 + Math.floor((slot - 2) / 3) * 85];
    return { x: layout.x + point[0], y: layout.y + point[1] };
}

export const buildings = [
    "apartment-building",
    "scandinavian-apartment-building",
    "building",
    "modern-house",
    "home",
    "property",
    "sanctuary",
    "villa",
];
