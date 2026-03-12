export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const oidc = (config as any).oidc
  return {
    providers: oidc?.providers
      ? Object.fromEntries(
          Object.entries(oidc.providers).map(([k, v]: [string, any]) => [
            k,
            {
              clientId: v?.clientId,
              authorizationUrl: v?.authorizationUrl,
              tokenUrl: v?.tokenUrl,
              userinfoUrl: v?.userinfoUrl,
              logoutUrl: v?.logoutUrl,
              redirectUri: v?.redirectUri,
              scope: v?.scope,
              requiredProperties: v?.requiredProperties,
            },
          ]),
        )
      : 'NO OIDC PROVIDERS FOUND',
    defaultProvider: oidc?.defaultProvider,
  }
})
