export function nameError(value, limit, kind = "이름") {
    if (!value.trim()) return `${kind}을 입력해 주세요.`;
    if (Array.from(value).length > limit) return `${kind}은 ${limit}자 이내로 입력해 주세요.`;
    return "";
}
export function bookmarkNameError(value) {
    return typeof value === "string" && value.trim() ? "" : "페이지 이름을 입력해 주세요.";
}
export function categoryError(value, categories, exceptId) {
    return (
        nameError(value, 10, "카테고리 이름") ||
        (categories.some((item) => item.id !== exceptId && item.name.trim() === value.trim())
            ? "이미 사용 중인 카테고리 이름입니다."
            : "")
    );
}
export function webUrl(value) {
    try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) ? url : null;
    } catch {
        return null;
    }
}
