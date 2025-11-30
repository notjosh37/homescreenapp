# Homescreen App - Style Guide

## CSS Style Patterns

### Colors
- Background: `var(--background)` or `rgba(139, 58, 46, 0.95)` for panels
- Text primary: `#ffffff`
- Text secondary: `rgba(255, 255, 255, 0.8)`
- Text muted: `rgba(255, 255, 255, 0.6)`
- Borders: `0.5px solid rgba(255, 255, 255, 0.2)`
- Hover borders: `rgba(255, 255, 255, 0.4)`
- Input/button backgrounds: `rgba(0, 0, 0, 0.2)` or `rgba(255, 255, 255, 0.05)`

### Typography
- Font family: `inherit` (Domine serif)
- Font weight: `400` (normal)
- Font sizes:
  - Labels/small: `0.7rem`
  - Body: `0.8rem` - `0.9rem`
  - Section headers: `0.75rem` uppercase with `letter-spacing: 0.5px`

### Buttons & Inputs
- Padding: `6px 10px` for small, `10px 20px` for standard
- Border: `0.5px solid rgba(255, 255, 255, 0.2)`
- Border radius: `0` (all corners are square, no rounded corners)
- Background: `rgba(0, 0, 0, 0.2)` for inputs/selects
- Transitions: `all 0.15s ease`
- Hover: increase background opacity, border to `0.4`
- Use `-webkit-appearance: none; appearance: none;` on selects to remove native styling

### Panels & Cards
- Background: `rgba(255, 255, 255, 0.05)`
- Backdrop filter: `blur(12px)` or `blur(20px)` for modals
- Border: `0.5px solid rgba(255, 255, 255, 0.2)`

### Select Dropdowns
```css
select {
    padding: 6px 10px;
    border: 0.5px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.2);
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.7rem;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s ease;
}
select option {
    background: var(--background);
    color: white;
}
```

## Node.js
- Use Node.js v22+ (required by Vite 7)
- Run dev server: `/Users/joshsyer/.nvm/versions/node/v22.21.1/bin/node ./node_modules/vite/bin/vite.js`

## TODO: Config System
- Update config export/import when adding new settings
- Config includes: shaderSettings (includes unsplashEnabled, unsplashQuery, unsplashUrl), notionSettings, feedSettings, sectionVisibility, todoLimit, shortcuts, sectionsOpen
- When adding new localStorage keys, update the config export in SettingsPage and the import handler
- Config file format: `homescreen-config.json`
