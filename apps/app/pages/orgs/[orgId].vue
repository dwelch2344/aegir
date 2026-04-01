<script setup lang="ts">
const route = useRoute()
const orgId = route.params.orgId as string
const { orgs } = useOrg()
const iam = useIam()

const org = ref<any>(null)
const loading = ref(true)
const error = ref('')

// Find our IAM org by keycloakId
const iamOrg = computed(() => orgs.value.find((o) => o.keycloakId === orgId) || null)

// Tabs
const activeTab = ref<'members' | 'roles' | 'relationships'>('members')

// --- Members state ---
const members = ref<any[]>([])
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

// --- Roles state ---
const showCreateRole = ref(false)
const newRoleKey = ref('')
const newRoleName = ref('')
const creatingRole = ref(false)
const roleError = ref('')
const expandedRoleId = ref<number | null>(null)
const newPermission = ref('')
const newPermRelType = ref('SELF')

// --- Relationships state ---
const relationships = ref<any[]>([])
const showAddRelationship = ref(false)
const relOrgSearch = ref('')
const relOrgResults = ref<any[]>([])
const searchingOrgs = ref(false)
const selectedRelOrg = ref<any>(null)
const newRelType = ref('PARTNER')
const addingRel = ref(false)
const relError = ref('')

// Delete org
const confirmDelete = ref(false)
const deleting = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [orgData, membersData] = await Promise.all([
      $fetch<any>(`/api/orgs/${orgId}`),
      $fetch<any[]>(`/api/orgs/${orgId}/members`),
    ])
    org.value = orgData
    members.value = membersData

    // Sync Keycloak members into IAM identities + memberships, then load IAM data
    if (iamOrg.value) {
      try {
        await $fetch(`/api/orgs/${orgId}/members/sync`, {
          method: 'POST',
          body: { iamOrgId: iamOrg.value.id },
        })
      } catch (syncErr: any) {
        console.warn('Failed to sync members from Keycloak', syncErr)
      }
      try {
        await loadIamData()
      } catch (iamErr: any) {
        console.warn('Failed to load IAM data', iamErr)
      }
    }
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to load organization'
  } finally {
    loading.value = false
  }
}

async function loadIamData() {
  if (!iamOrg.value) return
  const [roles, mships, rels] = await Promise.all([
    iam.searchRoles({}),
    iam.searchMemberships({ organizationIdIn: [iamOrg.value.id] }),
    iam.searchOrgRelationships({ ownerOrgIdIn: [iamOrg.value.id] }),
  ])
  allRoles.value = roles
  memberships.value = mships
  relationships.value = rels
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
    // Merge and deduplicate by id
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

async function addMember() {
  if (!selectedIdentity.value || !iamOrg.value) return
  adding.value = true
  addError.value = ''
  addSuccess.value = ''
  try {
    await iam.createMembership({
      identityId: selectedIdentity.value.id,
      organizationId: iamOrg.value.id,
      roleIds: selectedRoleIds.value.length ? selectedRoleIds.value : undefined,
    })
    addSuccess.value = `Added ${selectedIdentity.value.email}`
    selectedIdentity.value = null
    memberSearch.value = ''
    selectedRoleIds.value = []
    showAddMember.value = false
    memberships.value = await iam.searchMemberships({ organizationIdIn: [iamOrg.value.id] })
  } catch (e: any) {
    addError.value = e.message || 'Failed to add member'
  } finally {
    adding.value = false
  }
}

async function removeMembership(membershipId: number) {
  if (!iamOrg.value) return
  try {
    await iam.deleteMembership(membershipId)
    memberships.value = memberships.value.filter((m) => m.id !== membershipId)
  } catch (e: any) {
    error.value = e.message || 'Failed to remove member'
  }
}

async function toggleRole(membershipId: number, roleId: number, hasRole: boolean) {
  if (!iamOrg.value) return
  try {
    if (hasRole) {
      await iam.removeMembershipRole({ membershipId, roleId })
    } else {
      await iam.assignMembershipRole({ membershipId, roleId })
    }
    memberships.value = await iam.searchMemberships({ organizationIdIn: [iamOrg.value.id] })
  } catch (e: any) {
    error.value = e.message || 'Failed to update role'
  }
}

// --- Role actions ---

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
    allRoles.value = await iam.searchRoles({})
  } catch (e: any) {
    roleError.value = e.message || 'Failed to add permission'
  }
}

async function removePermission(roleId: number, permission: string, relationshipType: string) {
  try {
    await iam.removeRolePermission({ roleId, permission, relationshipType })
    allRoles.value = await iam.searchRoles({})
  } catch (e: any) {
    roleError.value = e.message || 'Failed to remove permission'
  }
}

// --- Relationship actions ---

async function searchOrgs() {
  if (!relOrgSearch.value.trim()) {
    relOrgResults.value = []
    return
  }
  searchingOrgs.value = true
  try {
    // Search orgs by name through IAM
    const config = useRuntimeConfig()
    const gatewayUrl = import.meta.server
      ? (config.gatewayUrl as string)
      : (config.public.gatewayUrl as string)
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($input: IamOrganizationSearchInput!) {
          iam { orgs { search(input: $input) { results { id key name } } } }
        }`,
        variables: { input: { nameLike: relOrgSearch.value.trim() } },
      }),
    })
    const json = await response.json() as any
    relOrgResults.value = (json.data?.iam?.orgs?.search?.results ?? [])
      .filter((o: any) => o.id !== iamOrg.value?.id)
  } finally {
    searchingOrgs.value = false
  }
}

function selectRelOrg(org: any) {
  selectedRelOrg.value = org
  relOrgSearch.value = org.name
  relOrgResults.value = []
}

async function addRelationship() {
  if (!selectedRelOrg.value || !iamOrg.value) return
  addingRel.value = true
  relError.value = ''
  try {
    await iam.createOrgRelationship({
      ownerOrgId: iamOrg.value.id,
      relatedOrgId: selectedRelOrg.value.id,
      relationshipType: newRelType.value,
    })
    selectedRelOrg.value = null
    relOrgSearch.value = ''
    showAddRelationship.value = false
    relationships.value = await iam.searchOrgRelationships({ ownerOrgIdIn: [iamOrg.value.id] })
  } catch (e: any) {
    relError.value = e.message || 'Failed to create relationship'
  } finally {
    addingRel.value = false
  }
}

async function removeRelationship(id: number) {
  if (!iamOrg.value) return
  try {
    await iam.deleteOrgRelationship(id)
    relationships.value = relationships.value.filter((r) => r.id !== id)
  } catch (e: any) {
    error.value = e.message || 'Failed to remove relationship'
  }
}

// --- Delete org ---

async function deleteOrg() {
  deleting.value = true
  try {
    await $fetch(`/api/orgs/${orgId}`, { method: 'DELETE' })
    const { fetchOrgs } = useOrg()
    await fetchOrgs()
    await navigateTo('/orgs')
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to delete organization'
    deleting.value = false
  }
}

function toggleRoleSelection(roleId: number) {
  const idx = selectedRoleIds.value.indexOf(roleId)
  if (idx === -1) {
    selectedRoleIds.value.push(roleId)
  } else {
    selectedRoleIds.value.splice(idx, 1)
  }
}

onMounted(load)
</script>

<template>
  <div class="max-w-3xl">
    <NuxtLink to="/orgs" class="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 inline-block">
      &larr; All organizations
    </NuxtLink>

    <div v-if="loading" class="text-gray-400 text-sm">Loading...</div>
    <div v-if="error" class="mb-4 p-3 rounded bg-red-900/40 text-red-300 text-sm">{{ error }}</div>

    <template v-if="org && !loading">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-semibold">{{ org.name }}</h1>
          <p v-if="org.description" class="text-sm text-gray-500 mt-1">{{ org.description }}</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-6 border-b border-gray-700">
        <button
          v-for="tab in [
            { key: 'members', label: 'Members', count: memberships.length },
            { key: 'roles', label: 'Roles', count: allRoles.length },
            { key: 'relationships', label: 'Relationships', count: relationships.length },
          ]"
          :key="tab.key"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
          :class="
            activeTab === tab.key
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
          "
          @click="activeTab = tab.key as any"
        >
          {{ tab.label }}
          <span class="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">{{ tab.count }}</span>
        </button>
      </div>

      <!-- ==================== MEMBERS TAB ==================== -->
      <div v-if="activeTab === 'members'">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-medium text-gray-400">Organization members</h2>
          <button
            class="px-3 py-1 rounded bg-gray-700 text-xs font-medium text-gray-300 hover:bg-gray-600 transition-colors"
            @click="showAddMember = !showAddMember"
          >
            {{ showAddMember ? 'Cancel' : 'Add member' }}
          </button>
        </div>

        <div v-if="addError" class="mb-3 p-2 rounded bg-red-900/40 text-red-300 text-sm">{{ addError }}</div>
        <div v-if="addSuccess" class="mb-3 p-2 rounded bg-emerald-900/40 text-emerald-300 text-sm">{{ addSuccess }}</div>

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
            <!-- Search results dropdown -->
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
                :class="
                  selectedRoleIds.includes(role.id)
                    ? 'bg-emerald-900/40 border-emerald-600 text-emerald-300'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                "
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

        <!-- Memberships list -->
        <div v-if="memberships.length === 0" class="text-gray-500 text-sm py-4">
          No members yet. Add an identity to this organization.
        </div>
        <div class="space-y-1">
          <div
            v-for="membership in memberships"
            :key="membership.id"
            class="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-200">{{ membership.identity.label }}</p>
              <p class="text-xs text-gray-500">{{ membership.identity.email }}</p>
              <div v-if="membership.roles.length" class="flex flex-wrap gap-1 mt-1.5">
                <span
                  v-for="role in membership.roles"
                  :key="role.id"
                  class="text-xs px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/50"
                >
                  {{ role.name }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2 ml-3">
              <!-- Role toggle dropdown -->
              <div class="relative group">
                <button
                  class="text-gray-500 hover:text-gray-300 transition-colors p-1"
                  title="Manage roles"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </button>
                <div class="hidden group-hover:block absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1">
                  <button
                    v-for="role in allRoles"
                    :key="role.id"
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-gray-700 transition-colors"
                    @click="toggleRole(membership.id, role.id, membership.roles.some((r: any) => r.id === role.id))"
                  >
                    <svg
                      v-if="membership.roles.some((r: any) => r.id === role.id)"
                      class="w-3.5 h-3.5 text-emerald-400 shrink-0"
                      fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span v-else class="w-3.5 shrink-0" />
                    <span :class="membership.roles.some((r: any) => r.id === role.id) ? 'text-emerald-300' : 'text-gray-300'">
                      {{ role.name }}
                    </span>
                  </button>
                </div>
              </div>

              <button
                class="text-gray-500 hover:text-red-400 transition-colors p-1"
                title="Remove member"
                @click="removeMembership(membership.id)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Keycloak members (legacy view) -->
        <div v-if="members.length > 0 && memberships.length === 0" class="mt-4">
          <h3 class="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">IdP Members</h3>
          <div class="space-y-1">
            <div
              v-for="member in members"
              :key="member.id"
              class="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
            >
              <div class="min-w-0 flex-1">
                <p class="text-sm text-gray-300">
                  {{ [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email }}
                </p>
                <p class="text-xs text-gray-500">{{ member.email }}</p>
              </div>
              <span v-if="!member.emailVerified" class="text-xs px-2 py-0.5 rounded bg-yellow-900/40 text-yellow-400">
                Pending
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== ROLES TAB ==================== -->
      <div v-if="activeTab === 'roles'">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-medium text-gray-400">Roles & permissions</h2>
          <button
            class="px-3 py-1 rounded bg-gray-700 text-xs font-medium text-gray-300 hover:bg-gray-600 transition-colors"
            @click="showCreateRole = !showCreateRole"
          >
            {{ showCreateRole ? 'Cancel' : 'New role' }}
          </button>
        </div>

        <div v-if="roleError" class="mb-3 p-2 rounded bg-red-900/40 text-red-300 text-sm">{{ roleError }}</div>

        <!-- Create role form -->
        <form v-if="showCreateRole" class="mb-4 p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3" @submit.prevent="createRole">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm text-gray-400 mb-1">Key</label>
              <input
                v-model="newRoleKey"
                type="text"
                placeholder="e.g. editor"
                class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Name</label>
              <input
                v-model="newRoleName"
                type="text"
                placeholder="e.g. Editor"
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
        <div v-if="allRoles.length === 0" class="text-gray-500 text-sm py-4">No roles defined yet.</div>
        <div class="space-y-2">
          <div
            v-for="role in allRoles"
            :key="role.id"
            class="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden"
          >
            <!-- Role header -->
            <button
              class="w-full flex items-center justify-between p-3 text-left hover:bg-gray-750 transition-colors"
              @click="expandedRoleId = expandedRoleId === role.id ? null : role.id"
            >
              <div>
                <span class="text-sm font-medium text-gray-200">{{ role.name }}</span>
                <span class="text-xs text-gray-500 ml-2">{{ role.key }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">{{ role.permissions.length }} permission{{ role.permissions.length !== 1 ? 's' : '' }}</span>
                <svg
                  class="w-4 h-4 text-gray-500 transition-transform"
                  :class="{ 'rotate-180': expandedRoleId === role.id }"
                  fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </button>

            <!-- Expanded permissions -->
            <div v-if="expandedRoleId === role.id" class="border-t border-gray-700 p-3">
              <!-- Existing permissions -->
              <div v-if="role.permissions.length === 0" class="text-xs text-gray-500 mb-3">No permissions assigned.</div>
              <div class="space-y-1 mb-3">
                <div
                  v-for="perm in role.permissions"
                  :key="perm.id"
                  class="flex items-center justify-between py-1.5 px-2 rounded bg-gray-900/50"
                >
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-mono text-gray-200">{{ perm.permission }}</span>
                    <span class="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{{ perm.relationshipType }}</span>
                  </div>
                  <button
                    class="text-gray-500 hover:text-red-400 transition-colors p-0.5"
                    title="Remove permission"
                    @click="removePermission(role.id, perm.permission, perm.relationshipType)"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Add permission form -->
              <form class="flex items-end gap-2" @submit.prevent="addPermission(role.id)">
                <div class="flex-1">
                  <label class="block text-xs text-gray-500 mb-1">Permission</label>
                  <input
                    v-model="newPermission"
                    type="text"
                    placeholder="e.g. ORG_UPDATE"
                    class="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div class="w-28">
                  <label class="block text-xs text-gray-500 mb-1">Scope</label>
                  <select
                    v-model="newPermRelType"
                    class="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="SELF">SELF</option>
                    <option value="PARENT">PARENT</option>
                    <option value="CHILD">CHILD</option>
                    <option value="PARTNER">PARTNER</option>
                  </select>
                </div>
                <button
                  type="submit"
                  :disabled="!newPermission.trim()"
                  class="px-3 py-1.5 rounded bg-emerald-600 text-xs font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== RELATIONSHIPS TAB ==================== -->
      <div v-if="activeTab === 'relationships'">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-medium text-gray-400">Organization relationships</h2>
          <button
            class="px-3 py-1 rounded bg-gray-700 text-xs font-medium text-gray-300 hover:bg-gray-600 transition-colors"
            @click="showAddRelationship = !showAddRelationship"
          >
            {{ showAddRelationship ? 'Cancel' : 'Add relationship' }}
          </button>
        </div>

        <div v-if="relError" class="mb-3 p-2 rounded bg-red-900/40 text-red-300 text-sm">{{ relError }}</div>

        <!-- Add relationship form -->
        <form v-if="showAddRelationship" class="mb-4 p-4 rounded-lg bg-gray-800 border border-gray-700 space-y-3" @submit.prevent="addRelationship">
          <div class="relative">
            <label class="block text-sm text-gray-400 mb-1">Related organization</label>
            <input
              v-model="relOrgSearch"
              type="text"
              placeholder="Search organizations..."
              class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
              @input="searchOrgs"
            />
            <div
              v-if="relOrgResults.length > 0"
              class="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto"
            >
              <button
                v-for="o in relOrgResults"
                :key="o.id"
                type="button"
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors"
                @click="selectRelOrg(o)"
              >
                <span class="text-gray-200">{{ o.name }}</span>
                <span class="text-gray-500 ml-2">{{ o.key }}</span>
              </button>
            </div>
            <div v-if="searchingOrgs" class="absolute right-3 top-8 text-xs text-gray-500">Searching...</div>
          </div>

          <div>
            <label class="block text-sm text-gray-400 mb-1">Relationship type</label>
            <select
              v-model="newRelType"
              class="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="PARENT">Parent</option>
              <option value="CHILD">Child</option>
              <option value="PARTNER">Partner</option>
              <option value="SELF">Self</option>
            </select>
          </div>

          <button
            type="submit"
            :disabled="addingRel || !selectedRelOrg"
            class="px-4 py-2 rounded bg-emerald-600 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {{ addingRel ? 'Adding...' : 'Add relationship' }}
          </button>
        </form>

        <!-- Relationships list -->
        <div v-if="relationships.length === 0" class="text-gray-500 text-sm py-4">No relationships defined.</div>
        <div class="space-y-1">
          <div
            v-for="rel in relationships"
            :key="rel.id"
            class="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700"
          >
            <div class="flex items-center gap-3">
              <span class="text-xs px-2 py-0.5 rounded font-medium"
                :class="{
                  'bg-blue-900/40 text-blue-300': rel.relationshipType === 'PARENT',
                  'bg-purple-900/40 text-purple-300': rel.relationshipType === 'CHILD',
                  'bg-amber-900/40 text-amber-300': rel.relationshipType === 'PARTNER',
                  'bg-gray-700 text-gray-400': rel.relationshipType === 'SELF',
                }"
              >
                {{ rel.relationshipType }}
              </span>
              <div>
                <p class="text-sm text-gray-200">{{ rel.relatedOrg.name }}</p>
                <p class="text-xs text-gray-500">{{ rel.relatedOrg.key }}</p>
              </div>
            </div>
            <button
              v-if="rel.relationshipType !== 'SELF'"
              class="text-gray-500 hover:text-red-400 transition-colors p-1"
              title="Remove relationship"
              @click="removeRelationship(rel.id)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Danger zone -->
      <div class="mt-8 pt-6 border-t border-gray-700">
        <h2 class="text-sm font-medium text-red-400 mb-3">Danger zone</h2>
        <div v-if="!confirmDelete">
          <button
            class="px-3 py-1.5 rounded border border-red-700 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
            @click="confirmDelete = true"
          >
            Delete organization
          </button>
        </div>
        <div v-else class="flex items-center gap-3">
          <span class="text-sm text-gray-400">Are you sure?</span>
          <button
            :disabled="deleting"
            class="px-3 py-1.5 rounded bg-red-700 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            @click="deleteOrg"
          >
            {{ deleting ? 'Deleting...' : 'Yes, delete' }}
          </button>
          <button
            class="px-3 py-1.5 rounded bg-gray-700 text-sm text-gray-300 hover:bg-gray-600 transition-colors"
            @click="confirmDelete = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
