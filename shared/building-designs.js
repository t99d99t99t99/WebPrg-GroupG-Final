export const BUILDING_FAMILIES = [
    { id: "blue-homes", name: "도심 주택", stages: [["house_small_blue"], ["house_medium_blue"], ["house_tall_blue"]] },
    {
        id: "light-brick-homes",
        name: "밝은 벽돌 주택",
        stages: [["house_small_brickred"], ["house_medium_brickwhite"], ["house_tall_brickwhite"]],
    },
    {
        id: "garden-homes",
        name: "정원 주택",
        stages: [["house_small_yellow"], ["house_medium_white"], ["house_tall_green"]],
    },
    { id: "food-market", name: "먹거리 상점", stages: [["fruitstand"], ["cafe", "icecream"], ["pizza"]] },
    { id: "service-market", name: "생활 상점", stages: [["clinic"], ["autoshop"], ["gunshop"]] },
];

export const BUILDING_DESIGNS = BUILDING_FAMILIES.flatMap((family) =>
    ["a", "b"].map((variant) => ({
        id: `${family.id}:${variant}`,
        family: family.id,
        variant,
        stage: 0,
        form: family.stages[0][0],
        name: `${family.name} ${variant === "a" ? "왼쪽" : "오른쪽"}`,
        src: `../assets/Isometric City/Buildings/bld_${family.stages[0][0]}_${variant}.png`,
    })),
);

const previousDesigns = [
    { id: "cafe:a", family: "food-market", variant: "a", stage: 1, form: "cafe", name: "카페" },
    { id: "pizza:a", family: "food-market", variant: "a", stage: 2, form: "pizza", name: "피자 가게" },
];

export function buildingDesignById(id) {
    const selected = [...BUILDING_DESIGNS, ...previousDesigns].find((design) => design.id === id);
    if (selected) return selected;
    // Accept persisted design IDs that identify a building family and direction.
    if (typeof id !== "string") return undefined;
    const [familyId, variant, extra] = id.split(":");
    const family = BUILDING_FAMILIES.find((item) => item.id === familyId);
    if (!family || !["a", "b"].includes(variant) || extra !== undefined) return undefined;
    return { id, family: familyId, variant, stage: 0, form: family.stages[0][0] };
}
