<script setup lang="ts">
const route = useRoute();
const { user, logout } = useOidcAuth();
const { orgs, activeOrg, fetchOrgs, setActiveOrg, onOrgSwitch } = useOrg();

const agent = useAgent();

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: "grid" },
  { label: "Projects", to: "/projects", icon: "folder" },
  { label: "Catalog", to: "/catalog", icon: "catalog" },
  { label: "Context", to: "/context", icon: "layers" },
  { label: "Best Practices", to: "/best-practices", icon: "sparkles" },
  { label: "IAM", to: "/iam", icon: "shield" },
  { label: "Agent", to: "/agent", icon: "chat" },
  { label: "Settings", to: "/settings", icon: "cog" },
];

function isActive(to: string) {
  return route.path === to || route.path.startsWith(to + "/");
}

const userMenuOpen = ref(false);
const orgSwitcherOpen = ref(false);

const displayName = computed(() => {
  const info = user.value?.userInfo as Record<string, any> | undefined;
  const claims = user.value?.claims as Record<string, any> | undefined;
  if (info?.name) return info.name;
  if (claims?.name) return claims.name;
  if (info?.given_name || info?.family_name)
    return [info.given_name, info.family_name].filter(Boolean).join(" ");
  if (claims?.given_name || claims?.family_name)
    return [claims.given_name, claims.family_name].filter(Boolean).join(" ");
  if (info?.email) return info.email;
  if (claims?.email) return claims.email;
  return user.value?.userName || "User";
});

const userEmail = computed(() => {
  const info = user.value?.userInfo as Record<string, any> | undefined;
  const claims = user.value?.claims as Record<string, any> | undefined;
  return info?.email || claims?.email || user.value?.userName || "";
});

const initials = computed(() => {
  const parts = displayName.value.split(" ");
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return displayName.value.slice(0, 2).toUpperCase();
});

function handleLogout() {
  logout("oidc", "/app/auth/logged-out");
}

function selectOrg(orgId: number) {
  setActiveOrg(orgId);
  orgSwitcherOpen.value = false;
}

// Listen for org switches and refresh org-bound data
onOrgSwitch(() => {
  agent.handleOrgSwitch();
});
</script>

<template>
  <div class="flex min-h-screen bg-gray-950 text-gray-100">
    <aside
      class="fixed inset-y-0 left-0 w-64 bg-gray-900 border-r border-gray-700 flex flex-col"
    >
      <div class="px-6 py-5 border-b border-gray-700">
        <NuxtLink
          to="/dashboard"
          class="text-lg font-semibold text-emerald-400"
        >
          aegir
        </NuxtLink>
      </div>

      <!-- Org switcher -->
      <div class="relative border-b border-gray-700">
        <button
          class="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-800 transition-colors"
          @click="orgSwitcherOpen = !orgSwitcherOpen"
        >
          <svg
            class="w-4 h-4 text-gray-500 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
            />
          </svg>
          <span class="flex-1 text-sm font-medium text-gray-200 truncate">
            {{ activeOrg?.name || "Select organization" }}
          </span>
          <svg
            class="w-3 h-3 text-gray-500 shrink-0 transition-transform"
            :class="{ 'rotate-180': orgSwitcherOpen }"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>

        <div
          v-if="orgSwitcherOpen"
          class="absolute top-full left-0 right-0 mt-1 mx-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50"
        >
          <button
            v-for="org in orgs"
            :key="org.id"
            class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors"
            :class="
              org.id === activeOrg?.id
                ? 'bg-gray-700 text-emerald-400'
                : 'text-gray-300 hover:bg-gray-700 hover:text-gray-100'
            "
            @click="selectOrg(org.id)"
          >
            <svg
              v-if="org.id === activeOrg?.id"
              class="w-3.5 h-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              />
            </svg>
            <span v-else class="w-3.5" />
            {{ org.name }}
          </button>
          <NuxtLink
            to="/orgs"
            class="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200 border-t border-gray-700 transition-colors"
            @click="orgSwitcherOpen = false"
          >
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
            </svg>
            Manage organizations
          </NuxtLink>
        </div>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-gray-700 text-emerald-400'
              : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          "
        >
          <svg
            class="w-5 h-5 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <template v-if="item.icon === 'grid'">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
              />
            </template>
            <template v-if="item.icon === 'folder'">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
              />
            </template>
            <template v-if="item.icon === 'catalog'">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
              />
            </template>
            <template v-if="item.icon === 'layers'">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0 4.179 2.25L12 17.25 2.25 12l4.179-2.25m11.142 0 4.179 2.25L12 22.5 2.25 17.25l4.179-2.25"
              />
            </template>
            <template v-if="item.icon === 'sparkles'">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
              />
            </template>
            <template v-if="item.icon === 'chat'">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
              />
            </template>
            <template v-if="item.icon === 'shield'">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
              />
            </template>
            <template v-if="item.icon === 'cog'">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </template>
          </svg>
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- User menu -->
      <div class="relative border-t border-gray-700">
        <button
          class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors"
          @click="userMenuOpen = !userMenuOpen"
        >
          <div
            class="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-medium text-white shrink-0"
          >
            {{ initials }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-200 truncate">
              {{ displayName }}
            </p>
            <p v-if="userEmail" class="text-xs text-gray-500 truncate">
              {{ userEmail }}
            </p>
          </div>
          <svg
            class="w-4 h-4 text-gray-500 shrink-0 transition-transform"
            :class="{ 'rotate-180': userMenuOpen }"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m4.5 15.75 7.5-7.5 7.5 7.5"
            />
          </svg>
        </button>

        <div
          v-if="userMenuOpen"
          class="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
        >
          <NuxtLink
            to="/profile"
            class="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors"
            @click="userMenuOpen = false"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
            Profile
          </NuxtLink>
          <button
            class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors"
            @click="handleLogout"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
              />
            </svg>
            Sign out
          </button>
        </div>

        <p class="px-4 pb-2 text-xs text-gray-600">v0.0.1</p>
      </div>
    </aside>

    <main class="flex-1 ml-64 p-6">
      <slot />
    </main>
  </div>
</template>
