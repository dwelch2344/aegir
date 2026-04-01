<script setup lang="ts">
const { activeOrg } = useOrg()
const iam = useIam()

const loading = ref(true)
const error = ref('')

// Is the active org the system org?
const isSystemOrg = computed(() => activeOrg.value?.key === 'system')

// Active section
const activeSection = ref<'members' | 'config'>('members')

// --- Members & Roles state ---
const memberships = ref<any[]>([])
const allRoles = ref<any[]>([])
const showAddMember = ref(false)
const memberSearch = ref('')
const identityResults = ref<any[]>([])
const searching = ref(false)
const selectedIdentity = ref<any>(null)
const selectedRoleIds = ref<number[]>([])
const adding = ref(false)
const addError = ref('')
const addSuccess = ref('')

// --- System Config state ---
const showCreateRole = ref(false)
const newRoleKey = ref('')
const newRoleName = ref('')
const creatingRole = ref(false)
const roleError = ref('')
const expandedRoleId = ref<number | null>(null)
const newPermission = ref('')
const newPermRelType = ref('SELF')

// Relationship type options for the permission scope selector
const relationshipTypes = ['SELF', 'SYS_CHILD', 'PARENT', 'CHILD', 'PARTNER']

async function load() {
  if (!activeOrg.value) return
  loading.value = true
  error.value = ''
  try {
    // Sync members from Keycloak if we have a keycloakId
    if (activeOrg.value.keycloakId) {
      try {
        await $fetch(`/api/orgs/${activeOrg.value.keycloakId}/members/sync`, {
          method: 'POST',
          body: { iamOrgId: activeOrg.value.id },
        })
      } catch {}
    }

    const [roles, mships] = await Promise.all([
      iam.searchRoles({}),
      iam.searchMemberships({ organizationIdIn: [activeOrg.value.id] }),
    ])
    allRoles.value = roles
    memberships.value = mships
  } catch (e: any) {
    error.value = e.message || 'Failed to load IAM data'
  } finally {
    loading.value = false
  }
}

// --- Member actions ---

async function searchIdentities() {
  const q = memberSearch.value.trim()
  if (!q) {
    identityResults.value = []
    return
  }
  searching.value = true
  try {
    const [byLabel, byEmail] = await Promise.all([
      iam.searchIdentities({ labelLike: q }),
      iam.searchIdentities({ emailLike: q }),
    ])
    const seen = new Set<number>()
    const merged = []
    for (const identity of [...byLabel, ...byEmail]) {
      if (!seen.has(identity.id)) {
        seen.add(identity.id)
        merged.push(identity)
      }
    }
    identityResults.value = merged
  } finally {
    searching.value = false
  }
}

function selectIdentity(identity: any) {
  selectedIdentity.value = identity
  memberSearch.value = identity.email
  identityResults.value = []
}

function toggleRoleSelection(roleId: number) {
  const idx = selectedRoleIds.value.indexOf(roleId)
  if (idx === -1) selectedRoleIds.value.push(roleId)
  else selectedRoleIds.value.splice(idx, 1)
}

async function addMember() {
  if (!selectedIdentity.value || !activeOrg.value) return
  adding.value = true
  addError.value = ''
  addSuccess.value = ''
  try {
    await iam.createMembership({
      identityId: selectedIdentity.value.id,
      organizationId: activeOrg.value.id,
      roleIds: selectedRoleIds.value.length ? selectedRoleIds.value : undefined,
    })
    addSuccess.value = `Added ${selectedIdentity.value.label}`
    selectedIdentity.value = null
    memberSearch.value = ''
    selectedRoleIds.value = []
    showAddMember.value = false
    memberships.value = await iam.searchMemberships({ organizationIdIn: [activeOrg.value.id] })
  } catch (e: any) {
    addError.value = e.message || 'Failed to add member'
  } finally {
    adding.value = false
  }
}

async function removeMember(membershipId: number) {
  if (!activeOrg.value) return
  await iam.deleteMembership(membershipId)
  memberships.value = await iam.searchMemberships({ organizationIdIn: [activeOrg.value.id] })
}

async function toggleRole(membershipId: number, roleId: number, hasRole: boolean) {
  if (!activeOrg.value) return
  try {
    if (hasRole) {
      await iam.removeMembershipRole({ membershipId, roleId })
    } else {
      await iam.assignMembershipRole({ membershipId, roleId })
    }
    memberships.value = await iam.searchMemberships({ organizationIdIn: [activeOrg.value.id] })
  } catch (e: any) {
    error.value = e.message || 'Failed to update role'
  }
}

// --- System Config: Role management ---

async function createRole() {
  if (!newRoleKey.value.trim() || !newRoleName.value.trim()) return
  creatingRole.value = true
  roleError.value = ''
  try {
    await iam.createRole({ key: newRoleKey.value.trim(), name: newRoleName.value.trim() })
    newRoleKey.value = ''
    newRoleName.value = ''
    showCreateRole.value = false
    allRoles.value = await iam.searchRoles({})
  } catch (e: any) {
    roleError.value = e.message || 'Failed to create role'
  } finally {
    creatingRole.value = false
  }
}

async function addPermission(roleId: number) {
  if (!newPermission.value.trim()) return
  try {
    await iam.addRolePermission({
      roleId,
      permission: newPermission.value.trim().toUpperCase(),
      relationshipType: newPermRelType.value,
    })
    newPermission.value = ''
    newPermRelType.value = 'SELF'
    allRoles.value = await iam.searchRoles({})
  } catch (e: any) {
    roleError.value = e.message || 'Failed to add permission'
  }
}

async function removePermission(roleId: number, permission: string, relationshipType: string) {
  try {
    await iam.removeRolePermission({ roleId, permission, relationshipType })
    allRoles.value = await iam.searchRoles({})
  } catch {}
}

onMounted(load)

watch(() => activeOrg.value?.id, () => {
  activeSection.value = 'members'
  load()
})
</script>

<template>
  <div class="max-w-4xl">
    <h1 class="text-xl font-semibold mb-1">Identity & Access Management</h1>
    <p class="text-sm text-gray-500 mb-6">
      {{ activeOrg?.name || 'No organization selected' }}
    </p>

    <div v-if="error" class="mb-4 p-3 rounded bg-red-900/40 text-red-300 text-sm">{{ error }}</div>

    <!-- Section tabs -->
    <div class="flex gap-4 border-b border-gray-700 mb-6">
      <button
        class="pb-2 text-sm font-medium transition-colors"
        :class="activeSection === 'members' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-200'"
        @click="activeSection = 'members'"
      >
        Members & Roles
      </button>
      <button
        v-if="isSystemOrg"
        class="pb-2 text-sm font-medium transition-colors"
        :class="activeSection === 'config' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-200'"
        @click="activeSection = 'config'"
      >
        IAM Configuration
      </button>
    </div>

    <div v-if="loading" class="text-gray-500 text-sm">Loading...</div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- SECTION 1: Members & Roles (available for all orgs) -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="!loading && activeSection === 'members'">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-medium">Organization Members</h2>
        <button
          class="px-3 py-1.5 rounded bg-emerald-600 text-sm font-medium hover:bg-emerald-500 transition-colors"
          @click="showAddMember = !showAddMember"
        >
          {{ showAddMember ? 'Cancel' : 'Add member' }}
        </button>
      </div>

      <div v-if="addSuccess" class="mb-3 p-3 rounded bg-emerald-900/40 text-emerald-300 text-sm">{{ addSuccess }}</div>
      <div v-if="addError" class="mb-3 p-3 rounded bg-red-900/40 text-red-300 text-sm">{{ addError }}</div>

      <!-- Add member form -->
      <form v-if="showAddMember" class="mb-4 p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3" @submit.prevent="addMember">
        <p class="text-xs text-gray-500">Search for an existing identity to add as a member.</p>
        <div class="relative">
          <label class="block text-sm text-gray-400 mb-1">Identity</label>
          <input
            v-model="memberSearch"
            type="text"
            placeholder="Search by name or email..."
            class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
            @input="searchIdentities"
          />
          <div
            v-if="identityResults.length > 0"
            class="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto"
          >
            <button
              v-for="identity in identityResults"
              :key="identity.id"
              type="button"
              class="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors"
              @click="selectIdentity(identity)"
            >
              <span class="text-gray-200">{{ identity.label }}</span>
              <span class="text-gray-500 ml-2">{{ identity.email }}</span>
            </button>
          </div>
          <div v-if="searching" class="absolute right-3 top-8 text-xs text-gray-500">Searching...</div>
        </div>

        <!-- Role selection -->
        <div v-if="allRoles.length > 0">
          <label class="block text-sm text-gray-400 mb-1">Roles (optional)</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="role in allRoles"
              :key="role.id"
              type="button"
              class="px-2.5 py-1 rounded text-xs font-medium border transition-colors"
              :class="selectedRoleIds.includes(role.id)
                ? 'bg-emerald-900/40 border-emerald-600 text-emerald-300'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'"
              @click="toggleRoleSelection(role.id)"
            >
              {{ role.name }}
            </button>
          </div>
        </div>

        <button
          type="submit"
          :disabled="adding || !selectedIdentity"
          class="px-4 py-2 rounded bg-emerald-600 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          {{ adding ? 'Adding...' : 'Add member' }}
        </button>
      </form>

      <!-- Members list -->
      <div v-if="memberships.length === 0 && !showAddMember" class="text-gray-500 text-sm">
        No members yet. Add someone to get started.
      </div>

      <div class="space-y-2">
        <div
          v-for="mship in memberships"
          :key="mship.id"
          class="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-200">{{ mship.identity?.label }}</p>
            <p class="text-xs text-gray-500">{{ mship.identity?.email }}</p>
            <div class="flex flex-wrap gap-1 mt-1">
              <span
                v-for="role in mship.roles"
                :key="role.id"
                class="px-1.5 py-0.5 rounded text-xs font-medium"
                :class="role.key === 'owner' ? 'bg-amber-900/40 text-amber-300' : role.key === 'admin' ? 'bg-blue-900/40 text-blue-300' : 'bg-gray-700 text-gray-300'"
              >
                {{ role.name }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Role toggle dropdown -->
            <div class="relative group">
              <button class="text-gray-500 hover:text-gray-300 transition-colors p-1" title="Manage roles">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </button>
              <div class="hidden group-hover:block absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1">
                <button
                  v-for="role in allRoles"
                  :key="role.id"
                  class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-700 transition-colors"
                  @click="toggleRole(mship.id, role.id, mship.roles?.some((r: any) => r.id === role.id))"
                >
                  <svg v-if="mship.roles?.some((r: any) => r.id === role.id)" class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span v-else class="w-3.5" />
                  <span class="text-gray-300">{{ role.name }}</span>
                </button>
              </div>
            </div>

            <!-- Remove member -->
            <button
              class="text-gray-500 hover:text-red-400 transition-colors p-1"
              title="Remove member"
              @click="removeMember(mship.id)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- SECTION 2: IAM Configuration (system org only) -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="!loading && activeSection === 'config' && isSystemOrg">
      <!-- Roles & Permissions -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-medium">Roles & Permissions</h2>
          <button
            class="px-3 py-1.5 rounded bg-emerald-600 text-sm font-medium hover:bg-emerald-500 transition-colors"
            @click="showCreateRole = !showCreateRole"
          >
            {{ showCreateRole ? 'Cancel' : 'New role' }}
          </button>
        </div>

        <div v-if="roleError" class="mb-3 p-3 rounded bg-red-900/40 text-red-300 text-sm">{{ roleError }}</div>

        <!-- Create role form -->
        <form v-if="showCreateRole" class="mb-4 p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3" @submit.prevent="createRole">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm text-gray-400 mb-1">Key</label>
              <input
                v-model="newRoleKey"
                type="text"
                placeholder="e.g. viewer"
                class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Name</label>
              <input
                v-model="newRoleName"
                type="text"
                placeholder="e.g. Viewer"
                class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <button
            type="submit"
            :disabled="creatingRole || !newRoleKey.trim() || !newRoleName.trim()"
            class="px-4 py-2 rounded bg-emerald-600 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {{ creatingRole ? 'Creating...' : 'Create role' }}
          </button>
        </form>

        <!-- Roles list -->
        <div class="space-y-2">
          <div
            v-for="role in allRoles"
            :key="role.id"
            class="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden"
          >
            <button
              class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-750 transition-colors"
              @click="expandedRoleId = expandedRoleId === role.id ? null : role.id"
            >
              <div>
                <span class="text-sm font-medium text-gray-200">{{ role.name }}</span>
                <span class="text-xs text-gray-500 ml-2">{{ role.key }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">{{ role.permissions?.length || 0 }} permissions</span>
                <svg
                  class="w-4 h-4 text-gray-500 transition-transform"
                  :class="{ 'rotate-180': expandedRoleId === role.id }"
                  fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </button>

            <div v-if="expandedRoleId === role.id" class="border-t border-gray-700 px-4 py-3 space-y-2">
              <!-- Existing permissions -->
              <div
                v-for="perm in role.permissions"
                :key="perm.id"
                class="flex items-center justify-between py-1.5 px-3 rounded bg-gray-900"
              >
                <div class="flex items-center gap-2">
                  <code class="text-xs text-gray-300">{{ perm.permission }}</code>
                  <span class="px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-400">{{ perm.relationshipType }}</span>
                </div>
                <button
                  class="text-gray-600 hover:text-red-400 transition-colors"
                  @click="removePermission(role.id, perm.permission, perm.relationshipType)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Add permission form -->
              <div class="flex items-end gap-2 pt-2">
                <div class="flex-1">
                  <label class="block text-xs text-gray-500 mb-1">Permission</label>
                  <input
                    v-model="newPermission"
                    type="text"
                    placeholder="e.g. ORG_UPDATE"
                    class="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">Scope</label>
                  <select
                    v-model="newPermRelType"
                    class="rounded bg-gray-900 border border-gray-700 px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option v-for="rt in relationshipTypes" :key="rt" :value="rt">{{ rt }}</option>
                  </select>
                </div>
                <button
                  class="px-3 py-1.5 rounded bg-emerald-700 text-xs font-medium text-emerald-100 hover:bg-emerald-600 transition-colors"
                  @click="addPermission(role.id)"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Relationship Types reference -->
      <div>
        <h2 class="text-lg font-medium mb-3">Org Relationship Types</h2>
        <p class="text-sm text-gray-500 mb-3">
          These relationship types are used to scope permissions in the ReBAC model.
          When a role has a permission scoped to a relationship type, it applies to all orgs
          reachable via that relationship chain.
        </p>
        <div class="grid grid-cols-2 gap-2">
          <div v-for="rt in relationshipTypes" :key="rt" class="p-3 rounded-lg bg-gray-800 border border-gray-700">
            <code class="text-sm text-emerald-400">{{ rt }}</code>
            <p class="text-xs text-gray-500 mt-1">
              <template v-if="rt === 'SELF'">Permission applies to the org itself</template>
              <template v-else-if="rt === 'SYS_CHILD'">Child org of the System org (all non-system orgs)</template>
              <template v-else-if="rt === 'PARENT'">Parent in a custom org hierarchy</template>
              <template v-else-if="rt === 'CHILD'">Child in a custom org hierarchy</template>
              <template v-else-if="rt === 'PARTNER'">Peer/partner relationship between orgs</template>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
