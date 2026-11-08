// Homepage display adapter only. Authentication belongs to the extension owner.
// Pass an already-authorized account after sign-in; pass null on sign-out.
export function setGoogleAccount(account = null) {
    const link = document.getElementById("google-account-link");
    const label = document.getElementById("google-account-label");
    const image = document.getElementById("google-account-photo");
    const fallback = document.getElementById("google-account-fallback");
    const name = typeof account?.displayName === "string" ? account.displayName.trim() : "";
    label.textContent = name || "계정";
    link.setAttribute("aria-label", name ? `Google 계정: ${name}` : "Google 계정");
    link.title = name || "Google 계정";
    fallback.textContent = Array.from(name)[0] ?? "";
    fallback.hidden = false;
    image.hidden = true;
    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");
    if (!account?.photoUrl) return;
    try {
        const url = new URL(account.photoUrl);
        if (url.protocol !== "https:") return;
        image.onload = () => {
            image.hidden = false;
            fallback.hidden = true;
        };
        image.onerror = () => {
            image.hidden = true;
            fallback.hidden = false;
        };
        image.src = url.href;
    } catch {
        /* Missing or invalid photos use the default avatar. */
    }
}
