import { resetAllData, settings } from "../db/db.js";
import { createColorPicker } from "../shared/color-picker.js";
import { prepareBackgroundImage } from "./background-image.js";

const $ = (id) => document.getElementById(id);
const TOGGLES = [
    ["settings-animation", "cityAnimation"],
    ["settings-new-tab", "openInNewTab"],
    ["settings-auto-sync", "autoSyncBookmarks"],
];

export function createSettingsPanel({
    onOpen = () => {},
    onClose = () => {},
    onSaved = () => {},
    onReset = () => {},
    onSync,
    onError = () => {},
} = {}) {
    const panel = $("settings-panel");
    const trigger = $("settings-button");
    const confirmation = $("settings-reset-confirm");
    const help = $("settings-animation-help");
    const fillButtons = [...$("settings-fill-mode").querySelectorAll("button")];
    const tileButtons = [...$("settings-tile-kind").querySelectorAll("button")];
    // Segmented settings that save one value: [fieldset id, button data key, settings field].
    const choices = [
        ["settings-density", "density", "decorationDensity"],
        ["settings-spacing", "spacing", "landSpacing"],
    ];
    let initial;
    let draft;
    let opening = false;
    let saving = false;
    let syncing = false;
    let uploading = false;
    let uploadController;
    let resetting = false;
    let resetCompleted = false;
    let generation = 0;
    let colorField;
    let changedFields = new Set();
    let writeQueue = Promise.resolve(true);
    let writeRevision = 0;

    function status(message, element = $("settings-status"), error = true) {
        element.textContent = message;
        element.hidden = !message;
        element.style.color = error ? "" : "var(--color-text-muted)";
    }
    function busy() {
        $("settings-save").disabled = saving || uploading || syncing;
        $("settings-cancel").disabled = saving;
        $("settings-reset").disabled = saving || uploading || syncing;
        $("sync-bookmarks").disabled = saving || syncing;
        $("settings-photo-upload").disabled = saving || uploading;
        $("settings-photo-upload").setAttribute("aria-busy", String(uploading));
        $("settings-photo-upload-label").textContent = uploading
            ? "이미지를 최적화하고 있습니다…"
            : "이미지를 선택하거나 이곳에 놓아 주세요";
        $("settings-reset-submit").disabled = resetting;
        $("settings-reset-cancel").disabled = resetting;
        panel.querySelector(".settings-body").inert = saving;
        $("settings-save").setAttribute("aria-busy", String(saving));
        $("sync-bookmarks").setAttribute("aria-busy", String(syncing));
        $("settings-reset-submit").setAttribute("aria-busy", String(resetting));
    }
    function positionPopup(picker, anchor, gap = 0) {
        const bounds = panel.getBoundingClientRect();
        const rect = anchor.getBoundingClientRect();
        const scaleX = bounds.width / panel.offsetWidth;
        const scaleY = bounds.height / panel.offsetHeight;
        picker.style.left = `${Math.max(
            0,
            Math.min((rect.left - bounds.left) / scaleX - panel.clientLeft, panel.clientWidth - picker.offsetWidth),
        )}px`;
        picker.style.top = `${Math.max(
            0,
            Math.min(
                (rect.bottom - bounds.top) / scaleY - panel.clientTop + gap,
                panel.clientHeight - picker.offsetHeight,
            ),
        )}px`;
    }
    const picker = createColorPicker($("settings-color-picker"), {
        onChange(color) {
            if (!draft || !colorField) return;
            draft.emptySpaceFill[colorField] = color;
            renderFill();
            applyDraft("emptySpaceFill");
        },
        position(host, anchor) {
            const gap = Number.parseFloat(getComputedStyle(host).getPropertyValue("--color-picker-trigger-gap"));
            positionPopup(host, anchor, gap);
        },
    });

    function renderFill() {
        const fill = draft.emptySpaceFill;
        // The four segments cover the saved `mode` + `colorMode`; a saved "none" matches no segment.
        const shown = fill.mode === "color" ? fill.colorMode : fill.mode;
        for (const button of fillButtons) button.setAttribute("aria-pressed", String(button.dataset.fill === shown));
        $("settings-solid").hidden = shown !== "solid";
        $("settings-gradient").hidden = shown !== "gradient";
        $("settings-fill-photo").hidden = shown !== "photo";
        $("settings-tile-kind").hidden = shown !== "tile";
        for (const button of tileButtons)
            button.setAttribute("aria-pressed", String(button.dataset.tile === fill.tileKind));
        for (const button of panel.querySelectorAll("[data-fill-color]")) {
            const color = fill[button.dataset.fillColor];
            button.querySelector(".settings-color-chip").style.backgroundColor = color;
            button.querySelector(".settings-color-hex").textContent = color.toUpperCase();
        }
        $("settings-solid-preview").style.background = fill.solidColor;
        $("settings-gradient-preview").style.background =
            `linear-gradient(${fill.angle}deg, ${fill.gradientStart}, ${fill.gradientEnd})`;
        $("settings-gradient-angle").value = String(fill.angle);
        $("settings-angle-value").value = `${fill.angle}°`;
        $("settings-photo-preview").hidden = !fill.photoDataUrl;
        if (fill.photoDataUrl) $("settings-photo-image").src = fill.photoDataUrl;
        else $("settings-photo-image").removeAttribute("src");
    }
    function render() {
        for (const [id, key, field] of choices)
            for (const button of $(id).querySelectorAll("button"))
                button.setAttribute("aria-pressed", String(button.dataset[key] === draft[field]));
        for (const [id, field] of TOGGLES) {
            const button = $(id);
            button.setAttribute("aria-checked", String(draft[field]));
            button.querySelector("img").src = `../assets/ui/settings-switch-${draft[field] ? "on" : "off"}.svg`;
        }
        renderFill();
    }
    function queueWrite(values, message = "설정을 반영하지 못했습니다. 다시 시도해 주세요.") {
        const revision = ++writeRevision;
        const token = generation;
        // Keep the latest complete edit when sliders change faster than storage can write.
        writeQueue = writeQueue
            .then(async () => {
                if (revision !== writeRevision) return true;
                if (Object.keys(values).length) {
                    await settings.edit(values);
                    await onSaved();
                }
                return true;
            })
            .catch((error) => {
                console.error(error);
                if (token === generation && draft) status(message);
                else onError(message);
                return false;
            });
        return writeQueue;
    }
    function changedValues(source) {
        return structuredClone(Object.fromEntries([...changedFields].map((field) => [field, source[field]])));
    }
    function applyDraft(field) {
        changedFields.add(field);
        status("");
        return queueWrite(changedValues(draft));
    }
    async function finish(cancel = false) {
        if (saving || resetting || (!cancel && (uploading || syncing)) || !draft) return;
        saving = true;
        if (cancel) uploadController?.abort();
        picker.close();
        busy();
        status("");
        try {
            const success = await queueWrite(
                changedValues(cancel ? initial : draft),
                cancel ? "설정을 복원하지 못했습니다. 다시 시도해 주세요." : undefined,
            );
            saving = false;
            if (success) close(true);
        } finally {
            saving = false;
            busy();
        }
    }
    function close(restoreFocus = false) {
        if (saving || resetting) return;
        uploadController?.abort();
        picker.close();
        panel.hidden = true;
        help.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-expanded", "false");
        generation++;
        draft = null;
        onClose();
        if (restoreFocus) trigger.focus();
    }
    async function open() {
        if (opening || !panel.hidden || confirmation.open) return;
        opening = true;
        try {
            await writeQueue;
            initial = await settings.get();
            draft = structuredClone(initial);
            changedFields = new Set();
            generation++;
            colorField = null;
            status("");
            $("settings-photo-file").value = "";
            render();
            onOpen();
            panel.hidden = false;
            trigger.setAttribute("aria-expanded", "true");
            busy();
            $("settings-density").querySelector('[aria-pressed="true"]').focus();
        } catch (error) {
            console.error(error);
            onError("설정을 불러오지 못했습니다.");
        } finally {
            opening = false;
        }
    }
    // The X button and a second click on the settings button cancel, like "설정 취소".
    trigger.addEventListener("click", () => (panel.hidden ? open() : finish(true)));
    $("settings-close").addEventListener("click", () => finish(true));
    $("settings-cancel").addEventListener("click", () => finish(true));
    help.addEventListener("click", () =>
        help.setAttribute("aria-expanded", String(help.getAttribute("aria-expanded") !== "true")),
    );
    $("settings-form").addEventListener("submit", (event) => {
        event.preventDefault();
        return finish();
    });
    for (const [id, key, field] of choices)
        for (const button of $(id).querySelectorAll("button"))
            button.addEventListener("click", () => {
                draft[field] = button.dataset[key];
                render();
                return applyDraft(field);
            });
    for (const button of tileButtons)
        button.addEventListener("click", () => {
            draft.emptySpaceFill.tileKind = button.dataset.tile;
            renderFill();
            return applyDraft("emptySpaceFill");
        });
    for (const [id, field] of TOGGLES)
        $(id).addEventListener("click", () => {
            draft[field] = !draft[field];
            render();
            return applyDraft(field);
        });

    for (const button of fillButtons)
        button.addEventListener("click", () => {
            const fill = draft.emptySpaceFill;
            if (["solid", "gradient"].includes(button.dataset.fill)) {
                fill.mode = "color";
                fill.colorMode = button.dataset.fill;
            } else fill.mode = button.dataset.fill;
            picker.close();
            renderFill();
            return applyDraft("emptySpaceFill");
        });
    for (const button of panel.querySelectorAll("[data-fill-color]"))
        button.addEventListener("click", () => {
            if (colorField === button.dataset.fillColor && picker.isOpen) {
                picker.close();
                return;
            }
            colorField = button.dataset.fillColor;
            picker.open(draft.emptySpaceFill[colorField], button);
        });
    $("settings-gradient-angle").addEventListener("input", (event) => {
        draft.emptySpaceFill.angle = Number(event.target.value);
        renderFill();
        return applyDraft("emptySpaceFill");
    });

    async function upload(file) {
        if (!file || uploading || !draft) return;
        const token = generation;
        uploading = true;
        const controller = new AbortController();
        uploadController = controller;
        busy();
        status("");
        try {
            const dataUrl = await prepareBackgroundImage(file, { signal: controller.signal });
            if (controller.signal.aborted || token !== generation || !draft) return;
            draft.emptySpaceFill.photoDataUrl = dataUrl;
            renderFill();
            await applyDraft("emptySpaceFill");
        } catch (error) {
            if (error.name === "AbortError") return;
            console.error(error);
            if (token === generation && draft)
                status(/[가-힣]/.test(error.message) ? error.message : "이미지를 불러오지 못했습니다.");
        } finally {
            uploading = false;
            uploadController = null;
            $("settings-photo-file").value = "";
            busy();
        }
    }
    $("settings-photo-upload").addEventListener("click", () => $("settings-photo-file").click());
    $("settings-photo-file").addEventListener("change", (event) => upload(event.target.files[0]));
    $("settings-photo-upload").addEventListener("dragover", (event) => {
        event.preventDefault();
        event.currentTarget.classList.add("drag-over");
    });
    $("settings-photo-upload").addEventListener("dragleave", (event) =>
        event.currentTarget.classList.remove("drag-over"),
    );
    $("settings-photo-upload").addEventListener("drop", (event) => {
        event.preventDefault();
        event.currentTarget.classList.remove("drag-over");
        upload(event.dataTransfer.files[0]);
    });
    $("settings-photo-remove").addEventListener("click", () => {
        draft.emptySpaceFill.photoDataUrl = "";
        renderFill();
        return applyDraft("emptySpaceFill");
    });

    $("sync-bookmarks").addEventListener("click", async () => {
        if (syncing || saving) return;
        const token = generation;
        syncing = true;
        busy();
        status("");
        try {
            const message = await onSync();
            if (token === generation && draft) status(message, $("settings-status"), false);
        } catch (error) {
            console.error(error);
            if (token === generation && draft) status(error.message || "크롬 북마크를 가져오지 못했습니다.");
        } finally {
            syncing = false;
            busy();
        }
    });
    $("settings-reset").addEventListener("click", () => {
        if (saving || syncing || uploading) return;
        picker.close();
        const bounds = panel.getBoundingClientRect();
        confirmation.style.left = `${bounds.left}px`;
        confirmation.style.top = `${bounds.top}px`;
        resetCompleted = false;
        status("", $("settings-reset-status"));
        panel.hidden = true;
        confirmation.showModal();
        $("settings-reset-cancel").focus();
    });
    $("settings-reset-cancel").addEventListener("click", () => confirmation.close());
    $("settings-reset-close").addEventListener("click", () => {
        if (!resetting) confirmation.close();
    });
    confirmation.addEventListener("cancel", (event) => {
        if (resetting) event.preventDefault();
    });
    confirmation.addEventListener("close", () => {
        if (resetCompleted) return;
        panel.hidden = false;
        $("settings-reset").focus();
    });
    $("settings-reset-submit").addEventListener("click", async () => {
        if (resetting) return;
        resetting = true;
        busy();
        status("", $("settings-reset-status"));
        try {
            await writeQueue;
            await resetAllData();
            await onReset();
            resetCompleted = true;
            confirmation.close();
            resetting = false;
            close(true);
        } catch (error) {
            console.error(error);
            status("데이터를 초기화하지 못했습니다. 다시 시도해 주세요.", $("settings-reset-status"));
        } finally {
            resetting = false;
            busy();
        }
    });
    panel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (picker.isOpen) {
                picker.close(true);
                return;
            }
            close(true);
        }
    });
    panel.querySelector(".settings-body").addEventListener("scroll", () => picker.close());
    document.addEventListener("pointerdown", (event) => {
        if (confirmation.open || panel.hidden) return;
        if (!help.contains(event.target)) help.setAttribute("aria-expanded", "false");
        if (!panel.contains(event.target) && !trigger.contains(event.target)) close();
    });
    return { open, close };
}
