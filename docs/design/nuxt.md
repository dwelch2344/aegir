# Nuxt App Stack & Theming Reference

## Tech Stack

- **Nuxt 3** (SPA mode, SSR disabled)
- **Vue 3** Composition API + TypeScript (strict)
- **Tailwind CSS** via `@nuxtjs/tailwindcss` — utility-only, no custom CSS files
- **Apollo Client** via `@nuxtjs/apollo` for GraphQL
- **Pinia** via `@pinia/nuxt` for state management
- **Monaco Editor** via `nuxt-monaco-editor`
- No UI component library — plain HTML5 elements styled with Tailwind

## Dark Theme Color Palette

All colors use Tailwind's default palette directly (no theme config, no CSS variables).

| Role           | Classes                                     |
| -------------- | ------------------------------------------- |
| Background     | `bg-gray-900`, `bg-gray-800`, `bg-gray-950` |
| Text primary   | `text-gray-100`                             |
| Text secondary | `text-gray-200`                             |
| Text tertiary  | `text-gray-400`                             |
| Borders        | `border-gray-700`                           |
| Primary accent | `emerald-400` / `emerald-600`               |
| Destructive    | `red-400` /` `red-600`                      |
| Contextual     | `amber-600`, `pink-600`, `blue-600`         |

## Component Patterns

### Cards / Panels

```html
<div class="rounded-lg border border-gray-700 bg-gray-900 p-4"></div>
```

### Buttons

```html
<!-- Primary -->
<button
  class="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 transition-colors text-sm"
>
  <!-- Secondary -->
  <button
    class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
  >
    <!-- Text / Tertiary -->
    <button
      class="text-xs text-gray-400 hover:text-gray-200 transition-colors"
    ></button>
  </button>
</button>
```

### Form Inputs

```html
<input
  class="w-full bg-gray-800 text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm"
/>
```

### Tables

```html
<!-- Header -->
<th class="border-b border-gray-700 text-gray-400 text-sm uppercase">
  <!-- Row -->
  <tr
    class="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
  ></tr>
</th>
```

### Modals

```html
<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md"></div>
</div>
```

## Layout

Sidebar layout (`layouts/default.vue`):

- Fixed sidebar: `w-64`, `bg-gray-900`
- Active nav link: `bg-gray-700 text-emerald-400`
- Hover nav link: `hover:bg-gray-700 transition-colors`
- Main content: flex-1 with `p-6` padding

## Pages Structure

Each entity follows a consistent pattern:

```
pages/
  <entity>/
    index.vue    # List view
    [id].vue     # Detail / edit view
    new.vue      # Create form (where applicable)
```

Entities: maps, items, skills, characters, classes, actors, enemies, troops, routes, route-groups, data.

## Common Utilities

- `transition-colors` on all interactive elements
- `disabled:opacity-50` for disabled states
- `grid grid-cols-1 md:grid-cols-3 gap-4` for responsive grids
- `flex items-center justify-between` for horizontal layouts
- Elevation via color contrast (borders/backgrounds), no box-shadows
