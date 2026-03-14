export default defineNuxtConfig({
  modules: ['nuxt-oidc-auth', '@nuxtjs/tailwindcss'],
  ssr: true,
  devtools: { enabled: true },

  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
  },

  runtimeConfig: {
    // Server-only: direct service-to-service URL (not through reverse proxy)
    gatewayUrl: process.env.GATEWAY_URL_INTERNAL || 'http://localhost:4000/graphql',
    public: {
      gatewayUrl: process.env.GATEWAY_URL || '/api/graphql',
      iamWsUrl: process.env.IAM_WS_URL || 'ws://localhost:4001/graphql',
      agentsWsUrl: process.env.AGENTS_WS_URL || 'ws://localhost:4003/graphql',
      projectsWsUrl: process.env.PROJECTS_WS_URL || 'ws://localhost:4004/graphql',
    },
  },

  oidc: {
    defaultProvider: 'oidc',
    providers: {
      oidc: {
        clientId: process.env.NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID || '',
        clientSecret: process.env.NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET || '',
        authorizationUrl: process.env.NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL || '',
        tokenUrl: process.env.NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL || '',
        userinfoUrl: process.env.NUXT_OIDC_PROVIDERS_OIDC_USERINFO_URL || '',
        logoutUrl: process.env.NUXT_OIDC_PROVIDERS_OIDC_LOGOUT_URL || '',
        redirectUri: process.env.NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI || '',
        scope: ['openid', 'email', 'profile', 'organization'],
        logoutRedirectParameterName: 'post_logout_redirect_uri',
        logoutRedirectUri:
          process.env.NUXT_OIDC_PROVIDERS_OIDC_LOGOUT_REDIRECT_URI || 'http://localhost:7356/app/auth/logged-out',
        additionalLogoutParameters: { idTokenHint: '' },
        exposeIdToken: true,
        requiredProperties: ['clientId', 'clientSecret', 'authorizationUrl', 'tokenUrl'],
        openIdConfiguration: process.env.NUXT_OIDC_PROVIDERS_OIDC_OPENID_CONFIGURATION || '',
        callbackRedirectUrl: process.env.NUXT_APP_BASE_URL || '/',
        exposeAccessToken: true,
        userNameClaim: 'email',
        optionalClaims: ['name', 'given_name', 'family_name', 'email'],
        validateAccessToken: false,
        validateIdToken: false,
        pkce: true,
        state: true,
        nonce: true,
      },
    },
    middleware: {
      globalMiddlewareEnabled: false,
    },
  },

  nitro: {
    storage: {
      oidc: {
        driver: 'fs',
        base: '.data/oidc',
      },
    },
  },

  compatibilityDate: '2025-01-01',
})
