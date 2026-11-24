const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// WheelEvent has no device type. Pixel gestures with small/fractional or two-axis deltas
// are treated as trackpad scrolling; Chrome's wheelDeltaY ratio helps with fast Mac gestures.
export function wheelIntent(event) {
    if (event.ctrlKey) return "zoom";
    if (event.deltaMode !== 0) return "zoom";
    if (event.deltaX || Math.abs(event.deltaY) < 40 || !Number.isInteger(event.deltaY)) return "pan";
    if (event.wheelDeltaY && Math.abs(event.wheelDeltaY + event.deltaY * 3) < 1) return "pan";
    return "zoom";
}

// Pixel-art assets are sharpest when one source pixel covers a whole number of device pixels.
// Wheel zoom levels (device px per source px) are indexed: 0 → 1, 1 → 1.5, 2 → 2, 3 → 2.5 …;
// -1 → 1/2, -2 → 1/3 …. Half steps repeat an even 2-to-3 pixel pattern, unlike arbitrary scales.
// `ratio` is device pixels per design-canvas pixel (page scale × devicePixelRatio).
export function levelIndex(zoom, ratio) {
    const k = zoom * ratio;
    return k >= 1 ? Math.round((k - 1) * 2) : 1 - Math.round(1 / k);
}
export function levelZoom(index, ratio) {
    return (index >= 0 ? 1 + index / 2 : 1 / (1 - index)) / ratio;
}
// The largest whole-number zoom that is not above `zoom` (fits the city at the sharpest scale).
export function crispZoomAtMost(zoom, ratio) {
    const k = zoom * ratio;
    return (k >= 1 ? Math.floor(k) : 1 / Math.ceil(1 / k)) / ratio;
}

export function zoomAt(view, point, factor, min, max) {
    const zoom = clamp(view.zoom * factor, min, max);
    const ratio = zoom / view.zoom;
    return { x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio, zoom };
}

// View coordinates are in the design canvas, independent of the browser's page scale.
// Camera state is intentionally local to this tab; it never changes saved building positions.
export function createMapCamera({ surface, canvas, world, canStart, onChange }) {
    let view = null;
    let minimum = 0.1;
    let manual = false;
    let drag = null;
    let frame = 0;
    let settleTimer;
    let interacting = false;
    let suppressAux = false;
    let wheelTime = -Infinity;
    let intent = null;
    // Wheel/pinch input collected (in log-zoom units) until it is enough for one zoom level.
    let pendingZoom = 0;
    const LEVEL_STEP = 0.15;

    const ratio = () => geometry().scale * devicePixelRatio;
    // Keep the zoom on a crisp level and the origin on the device pixel grid.
    function snap(next) {
        const r = ratio();
        const zoom = levelZoom(levelIndex(next.zoom, r), r);
        return { x: Math.round(next.x * r) / r, y: Math.round(next.y * r) / r, zoom };
    }
    function apply() {
        world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    }
    function paint() {
        frame = 0;
        apply();
        onChange({ ...view });
    }
    function change(next) {
        view = snap(next);
        manual = true;
        interacting = true;
        world.classList.add("camera-controlled");
        if (!frame) frame = requestAnimationFrame(paint);
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            if (!drag) interacting = false;
        }, 160);
    }
    function geometry() {
        const rect = canvas.getBoundingClientRect();
        return { rect, scale: rect.width / canvas.offsetWidth };
    }
    surface.addEventListener(
        "wheel",
        (event) => {
            if (!view || !canStart() || drag || !event.cancelable) return;
            event.preventDefault();
            const { rect, scale } = geometry();
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
            const delta = event.deltaY * unit;
            const now = performance.now();
            const nextIntent = wheelIntent(event);
            // Keep a two-finger flick's faster momentum events in the same pan gesture.
            if (event.ctrlKey || now - wheelTime > 180 || nextIntent === "pan") {
                if (nextIntent !== intent || now - wheelTime > 180) pendingZoom = 0;
                intent = nextIntent;
            }
            wheelTime = now;
            if (intent === "pan") {
                change({ ...view, x: view.x - (event.deltaX * unit) / scale, y: view.y - delta / scale });
            } else {
                pendingZoom += -clamp(delta, -240, 240) * (event.ctrlKey ? 0.01 : 0.002);
                if (Math.abs(pendingZoom) < LEVEL_STEP) return;
                const r = ratio();
                const zoom = levelZoom(levelIndex(view.zoom, r) + Math.sign(pendingZoom), r);
                pendingZoom = 0;
                if (zoom < minimum || zoom > 4) return;
                const point = { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
                change(zoomAt(view, point, zoom / view.zoom, 0, Infinity));
            }
        },
        { passive: false },
    );
    surface.addEventListener("pointerdown", (event) => {
        if (event.button !== 1 || !view || !canStart()) return;
        event.preventDefault(); // Disable middle-button browser autoscroll.
        suppressAux = false;
        const { scale } = geometry();
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, view: { ...view }, scale };
        interacting = true;
        surface.classList.add("camera-panning");
        surface.setPointerCapture(event.pointerId);
        onChange({ ...view });
    });
    surface.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        if (!(event.buttons & 4)) {
            finish();
            return;
        }
        const dx = event.clientX - drag.x,
            dy = event.clientY - drag.y;
        if (!suppressAux && Math.hypot(dx, dy) < 3) return;
        suppressAux = true;
        change({ ...view, x: drag.view.x + dx / drag.scale, y: drag.view.y + dy / drag.scale });
    });
    function finish() {
        if (!drag) return;
        const id = drag.id;
        drag = null;
        interacting = false;
        surface.classList.remove("camera-panning");
        if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
    }
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
        surface.addEventListener(name, (event) => {
            if (event.pointerId === drag?.id) finish();
        });
    window.addEventListener("blur", finish);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) finish();
    });
    surface.addEventListener(
        "auxclick",
        (event) => {
            if (event.button !== 1 || !suppressAux) return;
            event.preventDefault();
            event.stopPropagation();
            suppressAux = false;
        },
        true,
    );
    return {
        fit(next) {
            minimum = Math.min(0.1, next.zoom * 0.4);
            // A manual view is kept, but re-snapped because a resize can change the pixel ratio.
            view = snap(manual ? view : next);
            apply();
            return { ...view };
        },
        crispZoomAtMost: (zoom) => crispZoomAtMost(zoom, ratio()),
        pixelRatio: ratio,
        isInteracting: () => interacting,
    };
}
