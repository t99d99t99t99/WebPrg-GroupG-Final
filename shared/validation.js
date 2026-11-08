export function nameError(value, limit, kind = "이름") {
    if (!value.trim()) return `${kind}을 입력해 주세요.`;
    if (Array.from(value).length > limit) return `${kind}은 ${limit}자 이내로 입력해 주세요.`;
    if (!/^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ]+$/.test(value)) return "한글, 영문, 숫자, 공백만 사용할 수 있습니다.";
    return "";
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
