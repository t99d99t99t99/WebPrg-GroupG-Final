import { BookmarkDB } from "./bookmark.js";
import { CategoryDB } from "./category.js";

const BOOKMARK_DB_KEY = "webprg-bookmarkmap-bookmarks";
const CATEGORY_DB_KEY = "webprg-bookmarkmap-categories";

export const bookmarks = new BookmarkDB(BOOKMARK_DB_KEY);
export const categories = new CategoryDB(CATEGORY_DB_KEY);
