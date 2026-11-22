import { applyPreparedWallMask } from "../homepage/building-appearance.js";
import { wallColorAdjustments } from "../homepage/category-colors.js";
import { BUILDING_DESIGNS } from "./building-designs.js";

// Building design strip with left/right arrows: three designs at a time, the selected one highlighted.
// Styles: shared/building-picker.css. The popup still has its own copy of this strip (popup/popup.js).
export function buildingPicker({ host, previous, next }) {
    let selected = 0;
    let color = null;

    function paint() {
        if (!color) return;
        const adjustments = wallColorAdjustments(color, "small");
        for (const button of host.children) {
            button.style.setProperty("--wall-color", color);
            button.style.setProperty("--light-color", adjustments.lightColor);
            button.style.setProperty("--light-opacity", String(adjustments.lightOpacity));
            button.style.setProperty("--light-mode", adjustments.lightMode);
        }
    }

    function render() {
        const start = Math.min(Math.max(0, selected - 1), BUILDING_DESIGNS.length - 3);
        host.replaceChildren();
        for (let index = start; index < start + 3; index++) {
            const design = BUILDING_DESIGNS[index];
            const button = document.createElement("button");
            button.type = "button";
            button.className = "building-design";
            button.setAttribute("aria-label", design.name);
            button.setAttribute("aria-pressed", String(index === selected));
            const image = document.createElement("img");
            image.src = design.src;
            image.alt = "";
            const preview = document.createElement("span");
            preview.className = "building-preview";
            preview.setAttribute("aria-hidden", "true");
            const tint = document.createElement("span");
            tint.className = "preview-wall-tint";
            const light = document.createElement("span");
            light.className = "preview-wall-light";
            applyPreparedWallMask(image, tint, light);
            preview.append(image, tint, light);
            button.append(preview);
            button.addEventListener("click", () => {
                selected = index;
                render();
                host.querySelector('[aria-pressed="true"]')?.focus();
            });
            host.append(button);
        }
        // The first and last designs hide the arrow that cannot move further.
        previous.hidden = selected === 0;
        next.hidden = selected === BUILDING_DESIGNS.length - 1;
        paint();
    }

    for (const [arrow, step] of [
        [previous, -1],
        [next, 1],
    ]) {
        arrow.addEventListener("click", () => {
            selected = Math.max(0, Math.min(BUILDING_DESIGNS.length - 1, selected + step));
            render();
            if (arrow.hidden) host.querySelector('[aria-pressed="true"]')?.focus();
        });
    }

    return {
        get value() {
            return BUILDING_DESIGNS[selected].id;
        },
        // Selects the design with this id, or else the one of the same family and direction.
        select(id, { family, variant } = {}) {
            const index = BUILDING_DESIGNS.findIndex((design) => design.id === id);
            const similar = BUILDING_DESIGNS.findIndex(
                (design) => design.family === family && design.variant === variant,
            );
            selected = Math.max(0, index >= 0 ? index : similar);
            render();
        },
        // Walls take the category color, as the building will on the map.
        setColor(value) {
            color = value;
            paint();
        },
    };
}
