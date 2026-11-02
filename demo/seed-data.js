// Development/demo fixture, deliberately separate from rendering code.
// Uses exactly the team's existing Bookmark and Category storage fields.
export function createDemoData() {
    const now = Date.now();
    const definitions = [
        [
            "수업 자료",
            [
                ["수업 공지", "https://example.com/class-notice"],
                ["팀 과제 안내", "https://example.com/team-project"],
            ],
        ],
        [
            "작업 도구",
            [
                ["Figma", "https://www.figma.com/"],
                ["GitHub", "https://github.com/"],
            ],
        ],
        [
            "즐겨찾기",
            [
                ["YouTube", "https://www.youtube.com/"],
                ["네이버", "https://www.naver.com/"],
            ],
        ],
        [
            "구글",
            [
                ["Gmail", "https://mail.google.com/"],
                ["Google Drive", "https://drive.google.com/"],
            ],
        ],
    ];
    const categories = [];
    const bookmarks = [];
    for (const [name, links] of definitions) {
        const category = { id: crypto.randomUUID(), name, createdAt: now };
        categories.push(category);
        for (const [title, url] of links) {
            bookmarks.push({ id: crypto.randomUUID(), url, name: title, category: category.id, savedAt: now });
        }
    }
    return { categories, bookmarks };
}
