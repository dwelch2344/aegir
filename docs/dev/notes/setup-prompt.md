```
great, next- let's initialize the project. I'd like this to be a pnpm multi-module project. create the following:
- @aegir/common: shared utilities across frontend/backend
- @rebuild/domain: this is where domain types (User/Organization/etc) will be defined for backend/frontend
- @rebuild/app a nuxt.js app with SSR. It should be Vue 3 + tailwind, but all data will be served up by a Federated GraphQL graph
- @rebuild/gateway the Wundergraph federated gateway that will be the central point for all graph access. the `app` should communicate with this
- @rebuild/iam  a fastify-based subgraph microservice which will handle identities + organizations in the model. just stub this out with a basic graph / no data source / etc
- @rebuild/legal a fastify-based subgraph microservice which will handle contracts/agreements in the model. just stub this out with a basic graph / no data source / etc


all projects should use typescript and be independently buildable. eventually each microservice will each get it's own Dockerfile / container to run in, but for now we just focus on building horizontally across them all. the root of the project should also have a package.json script where `pnpm dev` builds common / turns on all the services in parallel, with watches so that a change to any rebuilds any part as needed.

Go ahead and set all this up. Make decisions as needed but don't let the tech sprawl get crazy- most of this should stay uniform. Add testing from the beginning where needed with vitest (and favor test files to be colocated with code, not in separate _tests_ folders or anything like that)
```
