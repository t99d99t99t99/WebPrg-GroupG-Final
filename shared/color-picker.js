function hsvHex(hue, saturation, value) {
    const chroma = value * saturation;
    const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = value - chroma;
    const rgb =
        hue < 60
            ? [chroma, x, 0]
            : hue < 120
              ? [x, chroma, 0]
              : hue < 180
                ? [0, chroma, x]
                : hue < 240
                  ? [0, x, chroma]
                  : hue < 300
                    ? [x, 0, chroma]
                    : [chroma, 0, x];
    return `#${rgb
        .map((channel) =>
            Math.round((channel + m) * 255)
                .toString(16)
                .padStart(2, "0"),
        )
        .join("")}`;
}

export function createColorPicker(
    host,
    { onChange = () => {}, onClose = () => {}, onError = () => {}, position, ignoreOutside = () => false } = {},
) {
    function node(tag, className, text) {
        const element = document.createElement(tag);
        element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }
    host.classList.add("category-color-picker");
    host.setAttribute("role", "dialog");
    host.hidden = true;
    const field = node("button", "picker-saturation");
    field.type = "button";
    field.setAttribute("aria-label", "채도와 밝기 선택");
    const point = node("span", "picker-selector");
    field.append(point);
    const hueLabel = node("label", "picker-hue-label", "색조");
    const hueInput = node("input", "picker-hue");
    Object.assign(hueInput, { type: "range", min: "0", max: "359" });
    hueInput.setAttribute("aria-label", "색조");
    hueLabel.append(hueInput);
    const hexLabel = node("label", "picker-hex-label", "Hex ");
    const hex = node("input", "picker-hex");
    hex.maxLength = 6;
    hex.spellcheck = false;
    hex.setAttribute("aria-label", "16진수 색상");
    hexLabel.append(hex);
    const tools = node("div", "picker-tools");
    const eyedropper = node("button", "picker-eyedropper", "⌁");
    eyedropper.type = "button";
    eyedropper.setAttribute("aria-label", "화면에서 색상 추출");
    const preview = node("span", "picker-preview");
    preview.setAttribute("aria-hidden", "true");
    tools.append(eyedropper, preview, node("span", "", "100 %"));
    host.replaceChildren(field, hueLabel, hexLabel, tools);
    let color = "#a6bce9",
        hue = 220,
        saturation = 0,
        value = 1,
        anchor,
        dragging = false,
        session = 0;

    function render() {
        hueInput.value = String(Math.round(hue));
        hex.value = color.slice(1).toUpperCase();
        field.style.backgroundColor = `hsl(${hue} 100% 50%)`;
        point.style.left = `${saturation * 100}%`;
        point.style.top = `${(1 - value) * 100}%`;
        host.style.setProperty("--picker-color", color);
    }
    function setColor(next) {
        if (!/^#[\da-f]{6}$/i.test(next)) return;
        color = next.toLowerCase();
        const [r, g, b] = color.match(/[\da-f]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255);
        const max = Math.max(r, g, b),
            min = Math.min(r, g, b),
            delta = max - min;
        hue =
            delta === 0
                ? 0
                : max === r
                  ? (((g - b) / delta) % 6) * 60
                  : max === g
                    ? ((b - r) / delta + 2) * 60
                    : ((r - g) / delta + 4) * 60;
        if (hue < 0) hue += 360;
        saturation = max === 0 ? 0 : delta / max;
        value = max;
        render();
    }
    function publish() {
        color = hsvHex(hue, saturation, value);
        render();
        onChange(color);
    }
    function close(restoreFocus = false) {
        if (host.hidden) return;
        host.hidden = true;
        dragging = false;
        session++;
        if (anchor) anchor.setAttribute("aria-expanded", "false");
        onClose();
        if (restoreFocus && anchor?.isConnected) anchor.focus();
    }
    function commitPoint(event) {
        const rect = field.getBoundingClientRect();
        saturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        value = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        publish();
    }
    field.addEventListener("pointerdown", (event) => {
        dragging = true;
        field.setPointerCapture(event.pointerId);
        commitPoint(event);
    });
    field.addEventListener("pointermove", (event) => {
        if (dragging) commitPoint(event);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
        field.addEventListener(type, () => {
            dragging = false;
        });
    field.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") saturation -= 0.04;
        else if (event.key === "ArrowRight") saturation += 0.04;
        else if (event.key === "ArrowUp") value += 0.04;
        else if (event.key === "ArrowDown") value -= 0.04;
        else return;
        event.preventDefault();
        saturation = Math.max(0, Math.min(1, saturation));
        value = Math.max(0, Math.min(1, value));
        publish();
    });
    hueInput.addEventListener("input", () => {
        hue = Number(hueInput.value);
        publish();
    });
    hex.addEventListener("change", () => {
        if (/^[\da-f]{6}$/i.test(hex.value.trim())) {
            setColor(`#${hex.value.trim()}`);
            onChange(color);
        } else hex.value = color.slice(1).toUpperCase();
    });
    eyedropper.addEventListener("click", async () => {
        if (!globalThis.EyeDropper) {
            onError("이 브라우저에서는 화면 색상 추출을 지원하지 않습니다.");
            return;
        }
        const currentSession = session;
        try {
            const { sRGBHex } = await new EyeDropper().open();
            if (host.hidden || session !== currentSession) return;
            setColor(sRGBHex);
            onChange(color);
        } catch (error) {
            if (error.name !== "AbortError") {
                console.error(error);
                onError("화면 색상을 가져오지 못했습니다.");
            }
        }
    });
    document.addEventListener("pointerdown", (event) => {
        if (
            !host.hidden &&
            !host.contains(event.target) &&
            !anchor?.contains(event.target) &&
            !ignoreOutside(event.target)
        )
            close();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !host.hidden) {
            event.preventDefault();
            close(true);
        }
    });
    window.addEventListener("resize", () => close());
    return {
        close,
        setColor,
        get isOpen() {
            return !host.hidden;
        },
        open(next, trigger) {
            if (anchor && anchor !== trigger) anchor.setAttribute("aria-expanded", "false");
            session++;
            anchor = trigger;
            setColor(next);
            host.hidden = false;
            anchor.setAttribute("aria-expanded", "true");
            if (position) position(host, anchor);
            else {
                const rect = anchor.getBoundingClientRect();
                host.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - host.offsetWidth - 8))}px`;
                host.style.top = `${Math.max(8, Math.min(rect.bottom + 8, innerHeight - host.offsetHeight - 8))}px`;
            }
            field.focus();
        },
    };
}
