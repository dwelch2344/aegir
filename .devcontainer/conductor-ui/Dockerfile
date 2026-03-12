FROM node:18-alpine AS build
RUN apk add --no-cache git python3 make g++
WORKDIR /app
RUN git clone --depth 1 https://github.com/conductor-oss/conductor.git /tmp/conductor && \
    cp -r /tmp/conductor/ui/. /app/ && \
    rm -rf /tmp/conductor

# homepage must be a full URL so the conductor UI's getBasename() can parse it
# with new URL(homepage).pathname → "/infra/conductor". CRA extracts just the
# pathname for PUBLIC_URL, so assets still use relative paths.
RUN sed -i '/"name"/a\  "homepage": "http://localhost/infra/conductor/",' package.json

RUN corepack enable && yarn install --frozen-lockfile
RUN yarn build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html/infra/conductor
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5000
