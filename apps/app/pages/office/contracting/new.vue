<script setup lang="ts">
const router = useRouter()
const { startSelectHealth } = useContracting()

const form = reactive({
  agentFirstName: '',
  agentLastName: '',
  agentEmail: '',
  agentPhone: '',
  agentNpn: '',
  residentState: '',
  requestedStates: [] as string[],
  hasC4CoCertification: false,
  hasCoLicense: false,
})

const submitting = ref(false)
const error = ref('')

const eligibleStates = ['UT', 'ID', 'CO', 'NV']
const allStates = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA',
  'VT','WA','WV','WI','WY','DC',
]

const isNonResident = computed(() =>
  form.residentState !== '' && !eligibleStates.includes(form.residentState)
)
const showCoException = computed(() =>
  isNonResident.value && form.requestedStates.includes('CO')
)

function toggleState(state: string) {
  const idx = form.requestedStates.indexOf(state)
  if (idx >= 0) {
    form.requestedStates.splice(idx, 1)
  } else {
    form.requestedStates.push(state)
  }
}

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    const { workflowId } = await startSelectHealth(form)
    router.push(`/office/contracting/${workflowId}`)
  } catch (e: any) {
    error.value = e.message || 'Failed to start contracting workflow'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink to="/office" class="text-gray-400 hover:text-gray-200 text-sm">&larr; Back to Office</NuxtLink>
    </div>

    <h1 class="text-2xl font-semibold text-gray-100">New Select Health Contract</h1>
    <p class="mt-1 text-sm text-gray-400">ACA new contract process — collect agent information and start the workflow</p>

    <form class="mt-6 space-y-6 max-w-2xl" @submit.prevent="submit">
      <!-- Agent Info -->
      <div class="rounded-lg border border-gray-700 bg-gray-900 p-5 space-y-4">
        <h2 class="text-sm font-medium text-gray-300 uppercase tracking-wide">Agent Information</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">First Name</label>
            <input v-model="form.agentFirstName" type="text" required
              class="w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-gray-100 text-sm focus:border-emerald-400 focus:outline-none" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Last Name</label>
            <input v-model="form.agentLastName" type="text" required
              class="w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-gray-100 text-sm focus:border-emerald-400 focus:outline-none" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Email</label>
            <input v-model="form.agentEmail" type="email" required
              class="w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-gray-100 text-sm focus:border-emerald-400 focus:outline-none" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Phone</label>
            <input v-model="form.agentPhone" type="tel" required
              class="w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-gray-100 text-sm focus:border-emerald-400 focus:outline-none" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">NPN (National Producer Number)</label>
            <input v-model="form.agentNpn" type="text" required
              class="w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-gray-100 text-sm focus:border-emerald-400 focus:outline-none" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Resident State</label>
            <select v-model="form.residentState" required
              class="w-full rounded bg-gray-800 border border-gray-600 px-3 py-2 text-gray-100 text-sm focus:border-emerald-400 focus:outline-none">
              <option value="" disabled>Select state</option>
              <option v-for="s in allStates" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Requested States -->
      <div class="rounded-lg border border-gray-700 bg-gray-900 p-5 space-y-4">
        <h2 class="text-sm font-medium text-gray-300 uppercase tracking-wide">Requested States</h2>
        <p class="text-xs text-gray-500">Select Health operates in UT, ID, CO, and NV only</p>

        <div class="flex gap-3">
          <button v-for="state in eligibleStates" :key="state" type="button"
            class="px-4 py-2 rounded text-sm font-medium border transition-colors"
            :class="form.requestedStates.includes(state)
              ? 'bg-emerald-400/20 border-emerald-400 text-emerald-400'
              : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'"
            @click="toggleState(state)">
            {{ state }}
          </button>
        </div>

        <p v-if="isNonResident && !form.requestedStates.includes('CO')" class="text-sm text-amber-400">
          Non-resident agents cannot appoint with Select Health unless they qualify for the Colorado exception.
        </p>
      </div>

      <!-- CO Exception -->
      <div v-if="showCoException" class="rounded-lg border border-amber-700/50 bg-amber-900/20 p-5 space-y-3">
        <h2 class="text-sm font-medium text-amber-400 uppercase tracking-wide">Colorado Exception</h2>
        <p class="text-xs text-gray-400">Non-resident agents may appoint for CO only with C4 certification and CO license.</p>

        <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input v-model="form.hasC4CoCertification" type="checkbox"
            class="rounded bg-gray-800 border-gray-600 text-emerald-400 focus:ring-emerald-400" />
          C4 Colorado Marketplace Certification
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input v-model="form.hasCoLicense" type="checkbox"
            class="rounded bg-gray-800 border-gray-600 text-emerald-400 focus:ring-emerald-400" />
          Licensed in Colorado
        </label>
      </div>

      <!-- Error -->
      <div v-if="error" class="rounded-lg border border-red-700/50 bg-red-900/20 p-4">
        <p class="text-sm text-red-400">{{ error }}</p>
      </div>

      <!-- Submit -->
      <div class="flex gap-3">
        <button type="submit" :disabled="submitting || form.requestedStates.length === 0"
          class="px-5 py-2.5 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {{ submitting ? 'Starting...' : 'Start Contracting Workflow' }}
        </button>
        <NuxtLink to="/office"
          class="px-5 py-2.5 rounded border border-gray-600 text-gray-400 text-sm hover:border-gray-500 hover:text-gray-300 transition-colors">
          Cancel
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
