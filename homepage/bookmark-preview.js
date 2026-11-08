import { webUrl } from "../shared/validation.js";

const previews = new WeakMap();
// Pointer sweeps across the map should not load every site it passes over.
const LIVE_PREVIEW_DELAY = 500;

export function clearBookmarkPreview(container) {
    clearTimeout(previews.get(container)?.timer);
    previews.get(container)?.observer?.disconnect();
    previews.delete(container);
    container.replaceChildren();
    container.hidden = true;
}

export function renderBookmarkPreview(container, bookmark) {
    const key = JSON.stringify([bookmark.id, bookmark.url, bookmark.preview]);
    if (previews.get(container)?.key === key) return;
    clearBookmarkPreview(container);
    const state = { key };
    previews.set(container, state);
    container.hidden = false;
    const url = webUrl(bookmark.url);
    if (!url) {
        const message = document.createElement("p");
        message.className = "preview-note";
        message.textContent = "미리보기를 표시할 수 없는 주소입니다.";
        container.append(message);
        return;
    }
    const window = document.createElement("div");
    window.className = "bookmark-preview-window";
    const caption = document.createElement("div");
    caption.className = "bookmark-preview-caption";
    const hint = document.createElement("span");
    hint.textContent = "사이트 설정에 따라 미리보기가 제한될 수 있습니다.";
    const open = document.createElement("a");
    open.href = url.href;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = "원본 열기 ↗";
    open.setAttribute("aria-label", `${bookmark.name} 원본 페이지 새 탭에서 열기`);
    caption.append(hint, open);
    container.append(window, caption);
    function renderLive() {
        if (previews.get(container) !== state) return;
        hint.textContent = "사이트 설정에 따라 미리보기가 제한될 수 있습니다.";
        const frame = document.createElement("iframe");
        frame.className = "bookmark-preview-frame";
        frame.title = `${bookmark.name} 페이지 미리보기`;
        frame.setAttribute("sandbox", "allow-scripts");
        frame.referrerPolicy = "no-referrer";
        frame.tabIndex = -1;
        frame.src = url.href;
        window.replaceChildren(frame);
        const fit = () => {
            frame.style.transform = `scale(${window.clientWidth / 1024})`;
        };
        fit();
        state.observer = new ResizeObserver(fit);
        state.observer.observe(window);
    }
    if (typeof bookmark.preview === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(bookmark.preview)) {
        const image = document.createElement("img");
        image.className = "bookmark-preview-image";
        image.alt = `${bookmark.name} 저장된 페이지 미리보기`;
        image.onerror = renderLive;
        image.src = bookmark.preview;
        window.append(image);
        hint.textContent = "저장된 페이지 미리보기";
    } else state.timer = setTimeout(renderLive, LIVE_PREVIEW_DELAY);
}
