const MAX_HISTORY = 30;
const ZOOM_LEVELS = [4, 6, 8, 12, 16, 24, 32, 48, 64];
const DRAFT_STORAGE_KEY = "debug-mask-editor-drafts-v1";

function element(id) {
    return document.getElementById(id);
}

function loadImage(url) {
    const image = new Image();
    image.src = url;
    return image.decode().then(() => image);
}

function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG 생성 실패"))), "image/png");
    });
}

// The mask is edited as RGBA pixels, so untouched fractional alpha values survive.
export function paintMaskLine(pixels, width, height, from, to, alpha) {
    let x = from.x;
    let y = from.y;
    const dx = Math.abs(to.x - x);
    const dy = Math.abs(to.y - y);
    const stepX = x < to.x ? 1 : -1;
    const stepY = y < to.y ? 1 : -1;
    let error = dx - dy;
    let changed = false;
    while (true) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
            const i = (y * width + x) * 4;
            if (pixels[i + 3] !== alpha) {
                pixels[i] = 255;
                pixels[i + 1] = 255;
                pixels[i + 2] = 255;
                pixels[i + 3] = alpha;
                changed = true;
            }
        }
        if (x === to.x && y === to.y) break;
        const twice = error * 2;
        if (twice > -dy) {
            error -= dy;
            x += stepX;
        }
        if (twice < dx) {
            error += dx;
            y += stepY;
        }
    }
    return changed;
}

export function createMaskEditor({ files = null, onChange = () => {}, onStorageError = () => {} } = {}) {
    const dialog = element("maskEditor");
    const canvas = element("maskEditorCanvas");
    const context = canvas.getContext("2d");
    const stage = element("maskEditorStage");
    const image = element("maskEditorImage");
    const grid = element("maskEditorGrid");
    const cursor = element("maskEditorCursor");
    const title = element("maskEditorFile");
    const status = element("maskEditorStatus");
    const pixelInfo = element("maskPixelInfo");
    const opacity = element("maskOpacity");
    const zoom = element("maskZoom");
    const zoomOut = element("maskZoomOut");
    const zoomIn = element("maskZoomIn");
    const gridToggle = element("maskGrid");
    const paint = element("maskPaint");
    const erase = element("maskErase");
    const select = element("maskSelect");
    const original = element("maskOriginal");
    const copyOpacity = element("maskCopyOpacity");
    const undo = element("maskUndo");
    const redo = element("maskRedo");
    const save = element("maskSave");
    const done = element("maskDone");
    const overview = element("maskOverview");
    const overviewImage = element("maskOverviewImage");
    const overviewCanvas = element("maskOverviewCanvas");
    const overviewContext = overviewCanvas.getContext("2d");
    const overviewScale = element("maskOverviewScale");
    const overviewValue = element("maskOverviewValue");
    const maskCanvas = document.createElement("canvas");
    const maskContext = maskCanvas.getContext("2d");
    const sessions = new Map();
    const drafts = new Map();
    const availableFiles = files ? new Set(files) : null;
    const notifyChanges = () =>
        onChange(availableFiles ? [...drafts.keys()].filter((file) => availableFiles.has(file)).length : drafts.size);
    let storage = null;
    try {
        storage = window.sessionStorage;
        const stored = storage.getItem(DRAFT_STORAGE_KEY);
        if (stored) {
            const values = JSON.parse(stored);
            if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("잘못된 편집 세션");
            for (const [file, url] of Object.entries(values)) {
                if (typeof url !== "string" || !url.startsWith("data:image/png;base64,")) {
                    throw new Error(`잘못된 마스크: ${file}`);
                }
                drafts.set(file, url);
            }
        }
    } catch (error) {
        console.error(error);
        storage = null;
        onStorageError("세션 저장소를 사용할 수 없습니다. 새로고침하기 전에 변경된 파일을 다운로드해 주세요.");
    }
    notifyChanges();
    let current = null;
    let tool = "paint";
    let originalVisible = false;
    let copiedAlpha = null;
    let pointer = null;
    let keyboardStroke = null;
    let cursorPosition = { x: 0, y: 0 };
    let opening = 0;

    function setStatus(message) {
        status.textContent = message;
    }

    function updateButtons() {
        undo.disabled = !current || current.undo.length === 0;
        redo.disabled = !current || current.redo.length === 0;
        save.disabled = !current;
        done.disabled = !current;
        original.disabled = !current;
        copyOpacity.disabled = !current;
        zoomOut.disabled = !current || Number(zoom.value) <= ZOOM_LEVELS[0];
        zoomIn.disabled = !current || Number(zoom.value) >= ZOOM_LEVELS.at(-1);
        paint.setAttribute("aria-pressed", String(tool === "paint"));
        erase.setAttribute("aria-pressed", String(tool === "erase"));
        select.setAttribute("aria-pressed", String(tool === "select"));
        paint.classList.toggle("btn-primary", tool === "paint");
        erase.classList.toggle("btn-primary", tool === "erase");
        select.classList.toggle("btn-primary", tool === "select");
        original.checked = originalVisible;
    }

    function maskImageData() {
        const data = maskContext.createImageData(current.width, current.height);
        data.data.set(current.pixels);
        return data;
    }

    function updatePreview() {
        if (!current) return;
        maskContext.putImageData(maskImageData(), 0, 0);
        const url = maskCanvas.toDataURL("image/png");
        current.sprite.style.setProperty("--wall-mask", `url("${url}")`);
        if (current.pixels.every((value, index) => value === current.originalPixels[index]))
            drafts.delete(current.file);
        else drafts.set(current.file, url);
        notifyChanges();
        if (storage) {
            try {
                storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(Object.fromEntries(drafts)));
            } catch (error) {
                console.error(error);
                onStorageError("세션 저장에 실패했습니다. 새로고침하기 전에 변경된 파일을 다운로드해 주세요.");
            }
        }
    }

    function showCursor() {
        if (!current) return;
        const scale = Number(zoom.value);
        cursor.hidden = false;
        cursor.style.left = `${cursorPosition.x * scale}px`;
        cursor.style.top = `${cursorPosition.y * scale}px`;
        cursor.style.width = `${scale}px`;
        cursor.style.height = `${scale}px`;
        const alpha = current.pixels[(cursorPosition.y * current.width + cursorPosition.x) * 4 + 3];
        pixelInfo.textContent = `선택 픽셀 ${cursorPosition.x}, ${cursorPosition.y} · 불투명도 ${Number(((alpha / 255) * 100).toFixed(2))}% (${alpha}/255)`;
    }

    function render() {
        if (!current) return;
        const data = context.createImageData(current.width, current.height);
        for (let i = 0; i < current.pixels.length; i += 4) {
            data.data[i] = 255;
            data.data[i + 1] = 30;
            data.data[i + 2] = 170;
            data.data[i + 3] = Math.round(current.pixels[i + 3] * 0.65);
        }
        context.putImageData(data, 0, 0);
        overviewContext.putImageData(data, 0, 0);
        overview.classList.toggle("show-original", originalVisible);
        const scale = Number(zoom.value);
        stage.style.width = `${current.width * scale}px`;
        stage.style.height = `${current.height * scale}px`;
        grid.style.backgroundSize = `${scale}px ${scale}px`;
        grid.hidden = originalVisible || !gridToggle.checked;
        stage.classList.toggle("show-original", originalVisible);
        if (!cursor.hidden) showCursor();
        updateButtons();
    }

    function historyPush() {
        current.undo.push(new Uint8ClampedArray(current.pixels));
        if (current.undo.length > MAX_HISTORY) current.undo.shift();
    }

    function restore(from, to) {
        if (!current || !from.length) return;
        to.push(new Uint8ClampedArray(current.pixels));
        current.pixels.set(from.pop());
        current.dirty = true;
        render();
        updatePreview();
        setStatus("수정 내용이 미리보기에 반영되었습니다.");
    }

    function pointFromEvent(event) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(((event.clientX - rect.left) * canvas.width) / rect.width);
        const y = Math.floor(((event.clientY - rect.top) * canvas.height) / rect.height);
        return {
            x: Math.max(0, Math.min(canvas.width - 1, x)),
            y: Math.max(0, Math.min(canvas.height - 1, y)),
        };
    }

    function paintAlpha() {
        if (copiedAlpha !== null) return copiedAlpha;
        const value = Number(opacity.value);
        return Math.round((Math.max(0, Math.min(100, Number.isFinite(value) ? value : 100)) / 100) * 255);
    }

    function toggleOriginal() {
        if (!current) return;
        originalVisible = !originalVisible;
        render();
        setStatus(originalVisible ? "원본을 표시합니다." : "마스크를 표시합니다.");
    }

    function copySelectedOpacity() {
        if (!current) return;
        copiedAlpha = current.pixels[(cursorPosition.y * current.width + cursorPosition.x) * 4 + 3];
        opacity.value = String(Number(((copiedAlpha / 255) * 100).toFixed(2)));
        tool = "paint";
        updateButtons();
        setStatus(`선택 픽셀의 불투명도 ${opacity.value}% (${copiedAlpha}/255)를 복사했습니다.`);
    }

    function changeZoom(step) {
        if (!current) return;
        const index = ZOOM_LEVELS.indexOf(Number(zoom.value));
        zoom.value = String(ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index + step))]);
        render();
        setStatus(`확대 ${zoom.value}배`);
    }

    function draw(from, to, alpha = tool === "erase" ? 0 : paintAlpha()) {
        cursorPosition = to;
        showCursor();
        const changed = paintMaskLine(current.pixels, current.width, current.height, from, to, alpha);
        if (changed) {
            current.dirty = true;
            render();
        }
        setStatus(`픽셀 ${to.x}, ${to.y} · ${alpha === 0 ? "지우기" : "칠하기"}`);
        return changed;
    }

    function finishKeyboardStroke() {
        if (!keyboardStroke || !current) return;
        if (!keyboardStroke.changed) current.undo.pop();
        keyboardStroke = null;
        updateButtons();
    }

    function keyboardDraw(position, alpha) {
        if (draw(position, position, alpha)) {
            keyboardStroke.changed = true;
            current.redo.length = 0;
            updatePreview();
        }
    }

    function finishStroke() {
        if (!pointer || !current) return;
        if (pointer.changed) {
            current.redo.length = 0;
            updatePreview();
        } else current.undo.pop();
        pointer = null;
        keyboardStroke = null;
        updateButtons();
    }

    async function open({ file, sprite, imageUrl, maskPath }) {
        const request = ++opening;
        current = null;
        pointer = null;
        stage.hidden = true;
        cursor.hidden = true;
        pixelInfo.textContent = "";
        title.textContent = file;
        setStatus("건물과 마스크를 불러오는 중입니다.");
        updateButtons();
        if (!dialog.open) dialog.showModal();
        try {
            const savedDraft = drafts.get(file);
            const [source, mask, draft] = await Promise.all([
                loadImage(imageUrl),
                loadImage(maskPath),
                savedDraft && !sessions.has(file) ? loadImage(savedDraft) : null,
            ]);
            if (request !== opening || !dialog.open) return;
            if (source.naturalWidth !== mask.naturalWidth || source.naturalHeight !== mask.naturalHeight) {
                throw new Error("건물과 마스크의 크기가 다릅니다.");
            }
            if (draft && (draft.naturalWidth !== mask.naturalWidth || draft.naturalHeight !== mask.naturalHeight)) {
                throw new Error("저장된 편집 내용과 원본 마스크의 크기가 다릅니다.");
            }
            current = sessions.get(file);
            if (!current) {
                maskCanvas.width = mask.naturalWidth;
                maskCanvas.height = mask.naturalHeight;
                maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                maskContext.drawImage(mask, 0, 0);
                const originalPixels = new Uint8ClampedArray(
                    maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data,
                );
                if (draft) {
                    maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                    maskContext.drawImage(draft, 0, 0);
                }
                current = {
                    file,
                    sprite,
                    width: mask.naturalWidth,
                    height: mask.naturalHeight,
                    pixels: new Uint8ClampedArray(
                        maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data,
                    ),
                    originalPixels,
                    undo: [],
                    redo: [],
                    dirty: Boolean(draft),
                };
                sessions.set(file, current);
            }
            current.sprite = sprite;
            canvas.width = maskCanvas.width = current.width;
            canvas.height = maskCanvas.height = current.height;
            overviewCanvas.width = current.width;
            overviewCanvas.height = current.height;
            image.src = imageUrl;
            overviewImage.src = imageUrl;
            image.width = current.width;
            image.height = current.height;
            cursorPosition = { x: 0, y: 0 };
            stage.hidden = false;
            render();
            setStatus(
                `${current.width} × ${current.height} 픽셀 · ${drafts.has(file) ? "세션에서 수정됨" : "원본 마스크"}`,
            );
            canvas.focus();
        } catch (error) {
            console.error(error);
            if (request === opening) setStatus("건물 또는 마스크를 불러오지 못했습니다. 다시 시도해 주세요.");
        }
    }

    paint.addEventListener("click", () => {
        tool = "paint";
        updateButtons();
    });
    erase.addEventListener("click", () => {
        tool = "erase";
        updateButtons();
    });
    select.addEventListener("click", () => {
        tool = "select";
        updateButtons();
    });
    original.addEventListener("change", toggleOriginal);
    copyOpacity.addEventListener("click", copySelectedOpacity);
    opacity.addEventListener("input", () => {
        copiedAlpha = null;
    });
    zoomOut.addEventListener("click", () => changeZoom(-1));
    zoomIn.addEventListener("click", () => changeZoom(1));
    zoom.addEventListener("change", render);
    overviewScale.addEventListener("input", () => {
        overview.style.setProperty("--overview-scale", String(Number(overviewScale.value) / 100));
        overviewValue.textContent = `${overviewScale.value}%`;
    });
    gridToggle.addEventListener("change", render);
    element("maskEditorClose").addEventListener("click", () => dialog.close());
    done.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
        finishStroke();
        finishKeyboardStroke();
        opening++;
    });
    undo.addEventListener("click", () => current && restore(current.undo, current.redo));
    redo.addEventListener("click", () => current && restore(current.redo, current.undo));
    canvas.addEventListener("pointerdown", (event) => {
        if (!current || event.button !== 0 || pointer) return;
        event.preventDefault();
        canvas.focus();
        const point = pointFromEvent(event);
        if (tool === "select") {
            cursorPosition = point;
            showCursor();
            setStatus(`픽셀 ${point.x}, ${point.y} 선택됨`);
            return;
        }
        canvas.setPointerCapture(event.pointerId);
        historyPush();
        pointer = { id: event.pointerId, last: point, changed: false };
        pointer.changed = draw(point, point);
    });
    canvas.addEventListener("pointermove", (event) => {
        if (!current) return;
        if (!pointer || pointer.id !== event.pointerId) return;
        const point = pointFromEvent(event);
        pointer.changed = draw(pointer.last, point) || pointer.changed;
        pointer.last = point;
    });
    canvas.addEventListener("pointerup", (event) => {
        if (pointer?.id === event.pointerId) finishStroke();
    });
    canvas.addEventListener("pointercancel", (event) => {
        if (pointer?.id === event.pointerId) finishStroke();
    });
    canvas.addEventListener("focus", () => current && showCursor());
    dialog.addEventListener("keydown", (event) => {
        if (!current || event.altKey) return;
        const target = event.target;
        if (
            (target?.tagName === "INPUT" && target.type !== "checkbox") ||
            ["SELECT", "TEXTAREA"].includes(target?.tagName) ||
            target?.isContentEditable
        )
            return;
        if (event.ctrlKey || event.metaKey) {
            if (event.code === "KeyZ" || (event.code === "KeyY" && !event.shiftKey)) {
                finishKeyboardStroke();
                if (event.code === "KeyY" || event.shiftKey) restore(current.redo, current.undo);
                else restore(current.undo, current.redo);
                event.preventDefault();
            }
            return;
        }
        const key = event.key.toLowerCase();
        if (["KeyQ", "KeyW", "KeyE"].includes(event.code)) {
            tool = { KeyQ: "paint", KeyW: "erase", KeyE: "select" }[event.code];
            updateButtons();
            setStatus({ paint: "칠하기 도구", erase: "지우기 도구", select: "픽셀 선택 도구" }[tool]);
        } else if (/^Digit[0-9]$/.test(event.code) && !event.shiftKey) {
            opacity.value = String(Number(event.code.slice(-1)) * 10 || 100);
            copiedAlpha = null;
            setStatus(`칠하기 불투명도 ${opacity.value}%`);
        } else if (event.code === "KeyO") toggleOriginal();
        else if (event.code === "KeyI") copySelectedOpacity();
        else if (!event.isComposing && (key === "+" || key === "=")) changeZoom(1);
        else if (!event.isComposing && (key === "-" || key === "_")) changeZoom(-1);
        else return;
        event.preventDefault();
    });
    canvas.addEventListener("keydown", (event) => {
        if (!current || event.ctrlKey || event.metaKey || event.altKey) return;
        const position = { ...cursorPosition };
        if (event.key === "ArrowLeft") position.x = Math.max(0, position.x - 1);
        else if (event.key === "ArrowRight") position.x = Math.min(current.width - 1, position.x + 1);
        else if (event.key === "ArrowUp") position.y = Math.max(0, position.y - 1);
        else if (event.key === "ArrowDown") position.y = Math.min(current.height - 1, position.y + 1);
        else if (event.code === "Space" || event.key === " ") {
            event.preventDefault();
            if (!keyboardStroke) {
                historyPush();
                keyboardStroke = { changed: false };
                keyboardDraw(position, paintAlpha());
            }
            return;
        } else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            finishKeyboardStroke();
            historyPush();
            keyboardStroke = { changed: false };
            keyboardDraw(position, 0);
            finishKeyboardStroke();
            return;
        } else return;
        event.preventDefault();
        cursorPosition = position;
        if (keyboardStroke) keyboardDraw(position, paintAlpha());
        else {
            showCursor();
            setStatus(`픽셀 ${position.x}, ${position.y}`);
        }
    });
    canvas.addEventListener("keyup", (event) => {
        if (event.code === "Space" || event.key === " ") finishKeyboardStroke();
    });
    canvas.addEventListener("blur", finishKeyboardStroke);
    save.addEventListener("click", async () => {
        if (!current) return;
        const session = current;
        try {
            const name = `wall-mask-${session.file}`;
            const pixels = new Uint8ClampedArray(session.pixels);
            const picker = window.showSaveFilePicker
                ? window.showSaveFilePicker({
                      suggestedName: name,
                      types: [{ description: "PNG 이미지", accept: { "image/png": [".png"] } }],
                  })
                : Promise.resolve(null);
            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = session.width;
            exportCanvas.height = session.height;
            const exportContext = exportCanvas.getContext("2d");
            const data = exportContext.createImageData(session.width, session.height);
            data.data.set(pixels);
            exportContext.putImageData(data, 0, 0);
            const [handle, blob] = await Promise.all([picker, canvasBlob(exportCanvas)]);
            if (handle) {
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = name;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            if (pixels.every((value, index) => value === session.pixels[index])) session.dirty = false;
            if (current === session) setStatus(`${name} 저장을 요청했습니다.`);
        } catch (error) {
            if (error.name === "AbortError") return;
            console.error(error);
            setStatus("PNG를 저장하지 못했습니다. 다시 시도해 주세요.");
        }
    });
    return {
        open,
        getDraft: (file) => drafts.get(file),
        isChanged: (file) => drafts.has(file),
    };
}
