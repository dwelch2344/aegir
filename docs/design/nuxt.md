# Nuxt App Stack & Theming Reference

## Tech Stack

- **Nuxt 3** (SPA mode via `nuxt-oidc-auth`, SSR for server API routes)
- **Vue 3** Composition API + `<script setup>` + TypeScript
- **Tailwind CSS** via `@nuxtjs/tailwindcss` — utility-only, no custom CSS files
- No UI component library — plain HTML5 elements styled with Tailwind

### Data Layer

**No Apollo Client. No Pinia.** The app uses lightweight composables with Vue `ref()` for state:

- **REST calls** — Nuxt `$fetch()` for Keycloak admin API and server-side proxied endpoints
- **GraphQL calls** — Raw `fetch()` via a shared `gql<T>()` helper that posts to the gateway
- **Subscriptions** — `graphql-transport-ws` WebSocket protocol for real-time updates

Each domain has its own composable:

| Composable | Purpose |
|------------|---------|
| `useOrg()` | Organization list, active org, Keycloak sync |
| `useIam()` | Roles, memberships, org relationships, identities |
| `useProjects()` | Project CRUD, workflow triggers, activity subscriptions |
| `useAgent()` | Agent chat conversations via Conductor workflows |
| `useCatalog()` | Catalog pattern browsing |

### Composable Pattern

Each composable wraps GraphQL operations behind typed functions:

```typescript
async function gql<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const config = useRuntimeConfig()
  const gatewayUrl = import.meta.server
    ? (config.gatewayUrl as string)
    : (config.public.gatewayUrl as string)

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await response.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data!
}
```

Functions return unwrapped results (not the raw GraphQL envelope):

```typescript
async function searchRoles(input: { idIn?: number[] } = {}): Promise<Role[]> {
  const data = await gql<{ iam: { roles: { search: { results: Role[] } } } }>(`...`)
  return data.iam.roles.search.results
}
```

State is managed with Vue `ref()` in the page, not centralized stores. Composables are stateless — they return functions, not reactive state.

### Workflow Triggers

For Conductor workflows (sync, diagnostics, apply-pattern), the pattern is:

1. Frontend calls a **GraphQL mutation** on the domain service
2. The resolver POSTs to the **orchestration REST API** and returns `{ workflowId }`
3. Frontend **subscribes** to activity events via WebSocket for real-time progress

```typescript
// useProjects.ts
async function syncProject(id: number) {
  return gql<...>(`mutation { projects { projects { sync(projectId: $id) { projectId workflowId } } } }`)
}
```

### Server API Routes

Nuxt server routes proxy Keycloak admin API calls. Located in `apps/app/server/api/`:

| Route | Purpose |
|-------|---------|
| `GET /api/orgs` | List Keycloak organizations |
| `GET /api/orgs/[orgId]` | Get org details |
| `POST /api/orgs` | Create org in Keycloak |
| `GET /api/orgs/[orgId]/members` | List Keycloak org members |

These use `kcAdmin()` utility (`server/utils/keycloak-admin.ts`) which authenticates via service account token.

---

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
| Destructive    | `red-400` / `red-600`                       |
| Contextual     | `amber-600`, `pink-600`, `blue-600`         |

## Component Patterns

### Cards / Panels

```html
<div class="rounded-lg border border-gray-700 bg-gray-900 p-4"></div>
```

### Buttons

```html
<!-- Primary -->
<button class="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 transition-colors text-sm">

<!-- Secondary -->
<button class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">

<!-- Text / Tertiary -->
<button class="text-xs text-gray-400 hover:text-gray-200 transition-colors">
```

### Form Inputs

```html
<input class="w-full bg-gray-800 text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm" />
```

### Tables

```html
<!-- Header -->
<th class="border-b border-gray-700 text-gray-400 text-sm uppercase">
<!-- Row -->
<tr class="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
```

### Modals

```html
<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md"></div>
</div>
```

### Tabs

```html
<div class="flex gap-4 border-b border-gray-700 mb-6">
  <button
    v-for="tab in tabs"
    :class="[
      'pb-2 text-sm transition-colors',
      activeTab === tab.key
        ? 'text-emerald-400 border-b-2 border-emerald-400'
        : 'text-gray-400 hover:text-gray-200',
    ]"
  >
    {{ tab.label }} <span class="ml-1 text-xs bg-gray-700 px-1.5 py-0.5 rounded-full">{{ tab.count }}</span>
  </button>
</div>
```

### Status Badges

```html
<span :class="['px-2 py-0.5 rounded text-xs', statusClass]">{{ status }}</span>
```

| Status | Classes |
|--------|---------|
| READY / success | `bg-emerald-900/50 text-emerald-400` |
| CLONING / active | `bg-blue-900/50 text-blue-400` |
| ERROR | `bg-red-900/50 text-red-400` |
| PENDING | `bg-gray-700 text-gray-400` |

## Layout

Sidebar layout (`layouts/default.vue`):

- Fixed sidebar: `w-64`, `bg-gray-900`
- Active nav link: `bg-gray-700 text-emerald-400`
- Hover nav link: `hover:bg-gray-700 transition-colors`
- Main content: flex-1 with `p-6` padding

Nav items: Dashboard, Projects, Catalog, Agent, Settings

## Pages Structure

```
pages/
  index.vue                # Dashboard
  projects/
    index.vue              # Project list
    [id]/index.vue         # Project detail (tabs: overview, patterns, actions, agent)
  orgs/
    index.vue              # Organization list
    [orgId].vue            # Org detail (tabs: members, roles, relationships)
  catalog/
    index.vue              # Catalog pattern browser
  settings.vue             # Settings
```

### Detail Page Pattern

Detail pages follow a consistent load → display → action pattern:

```typescript
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    // 1. Load primary data (REST or GraphQL)
    const data = await $fetch(`/api/...`)
    // 2. Load related data (GraphQL), isolated error handling
    try {
      await loadRelatedData()
    } catch (e) {
      console.warn('Non-critical data failed', e)
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to load'
  } finally {
    loading.value = false
  }
}

onMounted(load)
```

Key conventions:
- Isolate non-critical data loads in nested try/catch to avoid masking the primary data
- Use `onMounted()` for initial load, not `useFetch()` (SPA mode)
- Actions (sync, apply, delete) set per-action loading states and call `load()` after success

## Common Utilities

- `transition-colors` on all interactive elements
- `disabled:opacity-50` for disabled states
- `grid grid-cols-1 md:grid-cols-3 gap-4` for responsive grids
- `flex items-center justify-between` for horizontal layouts
- Elevation via color contrast (borders/backgrounds), no box-shadows
