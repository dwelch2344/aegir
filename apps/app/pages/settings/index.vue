<script setup lang="ts">
const { user } = useOidcAuth()

const sessionData = computed(() => {
  if (!user.value) return null
  const { accessToken, idToken, ...safe } = user.value as Record<string, any>
  return safe
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-gray-100">Settings</h1>
    <p class="mt-1 text-sm text-gray-400">Platform configuration and developer tools</p>

    <div class="mt-6 space-y-6">
      <section>
        <h2 class="text-sm font-medium text-gray-200 uppercase tracking-wide">Session</h2>
        <div class="mt-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <pre v-if="sessionData" class="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(sessionData, null, 2) }}</pre>
          <p v-else class="text-sm text-gray-500">Not logged in</p>
        </div>
      </section>

      <section>
        <h2 class="text-sm font-medium text-gray-200 uppercase tracking-wide">Developer</h2>
        <div class="mt-3 rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">GraphiQL Gateway</p>
              <p class="text-xs text-gray-400">Federated graph explorer</p>
            </div>
            <a
              href="/api/graphiql"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">IAM Subgraph</p>
              <p class="text-xs text-gray-400">Identity & access management schema</p>
            </div>
            <a
              href="/api/iam/graphiql"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">System Subgraph</p>
              <p class="text-xs text-gray-400">System domain schema</p>
            </div>
            <a
              href="/api/system/graphiql"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">Agents Subgraph</p>
              <p class="text-xs text-gray-400">AI conversation & orchestration schema</p>
            </div>
            <a
              href="/api/agents/graphiql"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">Projects Subgraph</p>
              <p class="text-xs text-gray-400">Projects domain schema</p>
            </div>
            <a
              href="/api/projects/graphiql"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">Practices Subgraph</p>
              <p class="text-xs text-gray-400">Best practices management schema</p>
            </div>
            <a
              href="/api/practices/graphiql"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-sm font-medium text-gray-200 uppercase tracking-wide">Infrastructure</h2>
        <div class="mt-3 rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">Grafana</p>
              <p class="text-xs text-gray-400">Metrics, logs, and traces</p>
            </div>
            <a
              href="/infra/grafana"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">Conductor</p>
              <p class="text-xs text-gray-400">Workflow orchestration UI</p>
            </div>
            <a
              href="/infra/conductor"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">Redpanda Console</p>
              <p class="text-xs text-gray-400">Kafka topics and consumer groups</p>
            </div>
            <a
              href="/infra/redpanda"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">Metabase</p>
              <p class="text-xs text-gray-400">Business intelligence and ad-hoc SQL queries</p>
            </div>
            <a
              href="/infra/metabase"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">MailHog</p>
              <p class="text-xs text-gray-400">SMTP testing &amp; email capture</p>
            </div>
            <a
              href="/infra/mailhog"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">Keycloak</p>
              <p class="text-xs text-gray-400">Identity provider admin console</p>
            </div>
            <a
              href="/infra/idp"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
          <div class="border-t border-gray-800" />
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-100">MinIO Console</p>
              <p class="text-xs text-gray-400">S3-compatible object storage</p>
            </div>
            <a
              href="/infra/minio"
              target="_blank"
              class="px-3 py-1 rounded text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Open
            </a>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
