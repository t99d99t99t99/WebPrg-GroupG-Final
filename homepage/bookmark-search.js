// Search data stays in this tab. Original names and stored bookmarks are never rewritten.
const INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const segments = new Intl.Segmenter("ko", { granularity: "grapheme" });
const collator = new Intl.Collator("ko", { numeric: true });
const normalize = (value) =>
    value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\u1100-\u1112]/gu, (letter) => INITIALS[letter.charCodeAt(0) - 0x1100]);
const initial = (letter) => {
    const code = letter.charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11172 ? INITIALS[Math.floor(code / 588)] : letter;
};

function searchable(raw) {
    let text = "";
    const spans = [];
    for (const { segment, index } of segments.segment(raw)) {
        for (const letter of normalize(segment)) {
            const next = /\s/u.test(letter) ? " " : letter;
            if (next === " " && (!text || text.endsWith(" "))) continue;
            text += next;
            for (let i = 0; i < next.length; i++) spans.push([index, index + segment.length]);
        }
    }
    if (text.endsWith(" ")) {
        text = text.slice(0, -1);
        spans.pop();
    }
    let compact = "";
    const compactSpans = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") continue;
        compact += text[i];
        compactSpans.push(spans[i]);
    }
    return { raw, text, spans, compact, compactSpans, initials: [...compact].map(initial).join("") };
}

function domainOf(url) {
    try {
        const parsed = new URL(url);
        return ["https:", "http:"].includes(parsed.protocol) ? parsed.hostname : "";
    } catch {
        return "";
    }
}

function titleMatch(field, token) {
    let position = field.text.indexOf(token);
    if (position >= 0) {
        // A later word-start match outranks an earlier occurrence inside a word.
        if (position > 0) {
            let wordStart = position;
            while (wordStart >= 0 && /[\p{L}\p{N}]/u.test(field.text[wordStart - 1]))
                wordStart = field.text.indexOf(token, wordStart + 1);
            if (wordStart >= 0) position = wordStart;
        }
        const tier = position === 0 ? 1 : /[\p{L}\p{N}]/u.test(field.text[position - 1]) ? 3 : 2;
        return { tier, position, length: token.length, spans: field.spans };
    }
    position = field.compact.indexOf(token);
    if (position >= 0) return { tier: 4, position, length: token.length, spans: field.compactSpans };
    if (/[ㄱ-ㅎ]/u.test(token)) {
        position = field.initials.indexOf(token);
        if (position >= 0) {
            // Initials replace only BMP Hangul; UTF-16 offsets stay aligned with compactSpans.
            return { tier: 5, position, length: token.length, spans: field.compactSpans };
        }
    }
    return null;
}

export function searchHighlightRanges(field, tokens) {
    const ranges = tokens.flatMap((token) => {
        const match = titleMatch(field, token);
        return match ? match.spans.slice(match.position, match.position + match.length) : [];
    });
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const range of ranges) {
        const last = merged.at(-1);
        if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
        else merged.push([...range]);
    }
    return merged;
}

export function createBookmarkSearch() {
    let entries = new Map();
    const cache = new Map();
    return {
        update(groups) {
            let changed = false;
            const next = new Map();
            for (const { category, items } of groups) {
                for (const bookmark of items) {
                    let entry = entries.get(bookmark.id);
                    if (!entry || entry.title.raw !== bookmark.name || entry.url !== bookmark.url) {
                        entry = {
                            title: searchable(bookmark.name),
                            domain: searchable(domainOf(bookmark.url)),
                            url: bookmark.url,
                        };
                        changed = true;
                    }
                    entry.bookmark = bookmark;
                    entry.category = category;
                    next.set(bookmark.id, entry);
                }
            }
            if (next.size !== entries.size) changed = true;
            entries = next;
            if (changed) cache.clear();
        },
        find(raw) {
            const query = normalize(raw).trim().replace(/\s+/gu, " ");
            if (!query) return { query, tokens: [], matches: [] };
            if (cache.has(query)) return cache.get(query);
            const tokens = [...new Set(query.split(" "))];
            const matches = [];
            for (const entry of entries.values()) {
                const hits = [];
                for (const token of tokens) {
                    const hit = titleMatch(entry.title, token);
                    if (hit) hits.push(hit);
                    else {
                        const position = entry.domain.text.indexOf(token);
                        if (position < 0) break;
                        hits.push({ tier: 6, position });
                    }
                }
                if (hits.length !== tokens.length) continue;
                let tier = Math.max(...hits.map((hit) => hit.tier));
                if (entry.title.text === query) tier = 0;
                else if (entry.title.text.startsWith(query)) tier = 1;
                else if (entry.title.compact === query.replaceAll(" ", "")) tier = Math.min(tier, 4);
                matches.push({ entry, tier, position: hits.reduce((sum, hit) => sum + hit.position, 0) });
            }
            matches.sort(
                (a, b) =>
                    a.tier - b.tier ||
                    a.position - b.position ||
                    collator.compare(a.entry.title.raw, b.entry.title.raw) ||
                    String(a.entry.bookmark.id).localeCompare(String(b.entry.bookmark.id)),
            );
            const result = { query, tokens, matches };
            cache.set(query, result);
            if (cache.size > 12) cache.delete(cache.keys().next().value);
            return result;
        },
    };
}
