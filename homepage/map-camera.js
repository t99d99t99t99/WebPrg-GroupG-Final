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

    function paint() {
        frame = 0;
        world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
        onChange({ ...view });
    }
    function change(next) {
        view = next;
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
            if (event.ctrlKey || now - wheelTime > 180 || nextIntent === "pan") intent = nextIntent;
            wheelTime = now;
            if (intent === "pan") {
                change({ ...view, x: view.x - (event.deltaX * unit) / scale, y: view.y - delta / scale });
            } else {
                const point = { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
                const factor = Math.exp(-clamp(delta, -240, 240) * (event.ctrlKey ? 0.01 : 0.002));
                change(zoomAt(view, point, factor, minimum, 4));
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
            if (!manual) view = next;
            world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
            return { ...view };
        },
        isInteracting: () => interacting,
    };
}
