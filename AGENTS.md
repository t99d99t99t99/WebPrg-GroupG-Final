# Styling guidance

- Treat `style.css` as the shared stylesheet for both `popup/` and `homepage/`, as described in `README.md`.
- Prefer existing custom properties from `style.css` for colors, typography, sizing, borders, radii, and other shared visual values.
- When a value needs to be shared but no suitable token exists, add or refine the token in `style.css` and use it from each page stylesheet.
- Keep `popup/popup.css` and `homepage/homepage.css` for page-specific layout and styles. Those files should reference shared `style.css` tokens where applicable instead of repeating shared values.
- Use a page-specific value only when the design genuinely differs for that page or the rule is only used there.
