// Google Service launcher (Figma USER-MAIN-CATEGORY-008). Every app is a link in homepage.html;
// this only moves the links between the nine launcher slots and the "추가 앱" list.
// ponytail: drag and drop only, as specified; add a keyboard way to pick apps if that is needed.
export function createGoogleLauncher({ load, save, onError }) {
    const $ = (id) => document.getElementById(id);
    const section = $("google-services");
    const grid = section.querySelector(".google-grid");
    const extras = $("google-extra-grid");
    const apps = [...section.querySelectorAll("a[data-app]")]; // HTML order is the "추가 앱" order.
    let saved = apps.slice(0, grid.children.length).map((app) => app.dataset.app);
    let dragged = null;

    function show(ids) {
        grid.replaceChildren(...ids.map((id) => apps.find((app) => app.dataset.app === id)));
        extras.replaceChildren(...apps.filter((app) => !ids.includes(app.dataset.app)));
    }
    function setEditing(editing) {
        section.classList.toggle("editing", editing);
        $("google-edit").hidden = editing;
        $("google-save").hidden = !editing;
        $("google-cancel").hidden = !editing;
    }
    function cancel() {
        show(saved);
        setEditing(false);
    }
    const slot = (event) => (dragged ? event.target.closest(".google-grid > a") : null);
    function mark(target) {
        for (const app of grid.children) app.classList.toggle("drop-target", app === target);
    }

    $("google-edit").addEventListener("click", () => setEditing(true));
    $("google-cancel").addEventListener("click", cancel);
    $("google-save").addEventListener("click", async () => {
        const next = [...grid.children].map((app) => app.dataset.app);
        try {
            await save(next);
            saved = next;
            setEditing(false);
        } catch (error) {
            console.error(error);
            onError("Google Service 구성을 저장하지 못했습니다. 다시 시도해 주세요.");
        }
    });
    // Only apps from "추가 앱" can be dropped; the dragged app swaps with the app in the slot
    // it is dropped on, which goes back to "추가 앱".
    extras.addEventListener("dragstart", (event) => {
        dragged = event.target.closest("a[data-app]");
        event.dataTransfer.effectAllowed = "move";
    });
    section.addEventListener("dragend", () => {
        dragged = null;
        mark(null);
    });
    grid.addEventListener("dragover", (event) => {
        const target = slot(event);
        if (!target) return;
        event.preventDefault();
        mark(target);
    });
    grid.addEventListener("drop", (event) => {
        const target = slot(event);
        if (!target) return;
        event.preventDefault();
        const ids = [...grid.children].map((app) => app.dataset.app);
        ids[ids.indexOf(target.dataset.app)] = dragged.dataset.app;
        show(ids);
    });

    return {
        cancel,
        // Reads the saved launcher (first load, and after a full reset).
        async refresh() {
            saved = [...(await load())];
            cancel();
        },
    };
}
