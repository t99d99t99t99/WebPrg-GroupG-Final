// Drag a category's name picket (the wooden sign) to another cell of the same land. On a building's
// cell the two swap places: the building moves to the cell the picket left. Dropping it outside the
// land or back on its own cell leaves it where it was; it never moves to another land.
// Decorations are not obstacles: they are laid out again around the picket's new cell.

import { gridAt } from "./building-move.js";
import { project, TILE_WIDTH } from "./layout.js";

const MOVE_TOLERANCE = 4; // Moving the pressed pointer farther than this picks the picket up.

/**
 * @param {object} options
 * @param {HTMLElement} options.world   transformed map layer (#world)
 * @param {HTMLElement} options.canvas  scaled page canvas (#canvas)
 * @param {HTMLElement} options.overlay layer for the drop marker (inside #world)
 * @param {() => void} options.onStart  called when a picket is picked up
 * @param {() => void} options.onEnd    called after the drag ends
 * @param {(categoryId: string, offset: {x: number, y: number}, swap: {bookmarkId: string, from: {x: number, y: number}, to: {x: number, y: number}} | null) => Promise<boolean>} options.commit
 *   saves the picket's new cell (an offset from the land's corner) and, with `swap`, moves the
 *   building that stood there from `from` to `to` (the picket's old cell)
 * @param {(message: string) => void} options.toast
 */
export function createPicketDrag({ world, canvas, overlay, onStart, onEnd, commit, toast }) {
    let press = null;
    let drag = null;

    // Map position under a pointer, in world pixels (both the page scale and the map zoom undone).
    function toWorld(clientX, clientY) {
        const origin = world.getBoundingClientRect();
        const pageScale = new DOMMatrixReadOnly(getComputedStyle(canvas).transform).a || 1;
        const zoom = new DOMMatrixReadOnly(getComputedStyle(world).transform).a || 1;
        const scale = pageScale * zoom;
        return { left: (clientX - origin.left) / scale, top: (clientY - origin.top) / scale };
    }

    // The picket stands on the centre of its cell.
    const baseOf = (cell) => project(cell.x + 0.5, cell.y + 0.5);

    /**
     * @param {HTMLElement} node  the picket element
     * @param {{category: object, area: object, cells: Map, picket: {x:number,y:number}}} group
     */
    function attach(node, group) {
        node.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || drag) return;
            event.preventDefault(); // no text selection or native drag from the sign
            press = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, node, group };
        });
    }

    function pickUp(event) {
        const { node, group, pointerId } = press;
        press = null;
        if (!node.isConnected) return;
        try {
            node.setPointerCapture(pointerId);
        } catch {
            // Capture is only a convenience: moves and the release are also heard on window.
        }
        onStart();
        const home = group.picket;
        const pointer = toWorld(event.clientX, event.clientY);
        const base = baseOf(home);
        const ghost = node.cloneNode(true);
        ghost.classList.add("picket-ghost");
        node.parentElement.append(ghost);
        node.classList.add("picket-source");
        const marker = document.createElement("div");
        marker.className = "drop-marker";
        marker.hidden = true;
        overlay.append(marker);
        document.body.classList.add("picket-dragging");
        const buildings = new Map([...group.cells].map(([id, cell]) => [`${cell.x},${cell.y}`, id]));
        drag = {
            node,
            group,
            pointerId,
            ghost,
            marker,
            buildings,
            home,
            grab: { left: pointer.left - base.left, top: pointer.top - base.top },
            target: null,
            dropping: false,
        };
        follow(event.clientX, event.clientY);
    }

    // The cell of the picket's own land under the grid point, with the id of the building standing
    // there (if any), or null outside the land.
    function cellAt(point) {
        const cell = { x: Math.floor(point.x), y: Math.floor(point.y) };
        const { area } = drag.group;
        const inside = cell.x >= area.x && cell.x < area.x + area.w && cell.y >= area.y && cell.y < area.y + area.h;
        if (!inside) return null;
        return { ...cell, bookmarkId: drag.buildings.get(`${cell.x},${cell.y}`) ?? null };
    }

    function place(node, left, top, zIndex) {
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
        node.style.zIndex = String(zIndex);
    }

    function follow(clientX, clientY) {
        const pointer = toWorld(clientX, clientY);
        const base = { left: pointer.left - drag.grab.left, top: pointer.top - drag.grab.top };
        const cell = cellAt(gridAt(base.left, base.top));
        const atHome = cell && cell.x === drag.home.x && cell.y === drag.home.y;
        drag.target = cell && !atHome ? cell : null;
        if (cell) {
            const at = baseOf(cell);
            place(drag.ghost, at.left, at.top, 1000 + cell.x + cell.y + 1);
        } else {
            place(drag.ghost, base.left, base.top, 2999);
        }
        drag.ghost.classList.toggle("drag-invalid", !cell);
        drag.marker.hidden = !drag.target;
        if (drag.target) {
            const top = project(cell.x, cell.y);
            drag.marker.style.left = `${top.left - TILE_WIDTH / 2}px`;
            drag.marker.style.top = `${top.top}px`;
            drag.marker.style.setProperty("--marker-color", drag.group.category.color ?? "#485b78");
        }
    }

    // `force` ends a drag that is waiting for its move to be saved.
    function finish(force = false) {
        if (!drag || (drag.dropping && !force)) return;
        const { node, pointerId } = drag;
        drag.ghost.remove();
        drag.marker.remove();
        node.classList.remove("picket-source");
        document.body.classList.remove("picket-dragging");
        drag = null;
        try {
            node.releasePointerCapture(pointerId);
        } catch {
            // Already released.
        }
        onEnd();
    }

    async function drop() {
        if (drag.dropping) return;
        const { target, group } = drag;
        // Nowhere valid: the picket simply stays.
        if (!target) return finish();
        // Keep the ghost on the new cell until the save is done, so it does not flash back first.
        drag.dropping = true;
        drag.marker.hidden = true;
        try {
            const offset = { x: target.x - group.area.x, y: target.y - group.area.y };
            const swap = target.bookmarkId
                ? {
                      bookmarkId: target.bookmarkId,
                      from: { x: target.x, y: target.y },
                      to: { x: drag.home.x, y: drag.home.y },
                  }
                : null;
            const saved = await commit(group.category.id, offset, swap);
            if (!saved) toast("표지판을 옮기지 못했습니다. 다시 시도해 주세요.");
        } catch (error) {
            console.error(error);
            toast("표지판을 옮기지 못했습니다.");
        } finally {
            finish(true);
        }
    }

    window.addEventListener("pointermove", (event) => {
        // The button was released somewhere we did not hear (another window or tab): cancel.
        if ((event.buttons & 1) === 0 && event.pointerType === "mouse") {
            press = null;
            finish();
            return;
        }
        if (press && event.pointerId === press.pointerId) {
            if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) pickUp(event);
            return;
        }
        if (drag && !drag.dropping && event.pointerId === drag.pointerId) follow(event.clientX, event.clientY);
    });
    window.addEventListener("pointerup", (event) => {
        if (press && event.pointerId === press.pointerId) press = null;
        if (drag && event.pointerId === drag.pointerId) drop();
    });
    window.addEventListener("pointercancel", () => {
        press = null;
        finish();
    });
    window.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Escape" && drag && !drag.dropping) {
                event.stopPropagation();
                finish();
            }
        },
        true,
    );

    return { attach, isDragging: () => Boolean(drag) };
}
