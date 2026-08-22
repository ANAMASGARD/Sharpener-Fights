import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  RangeRequestsPlugin,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
} from "serwist";

// Injected at production build time by @serwist/next.
// @ts-expect-error The manifest exists only after InjectManifest transforms this source.
const precacheManifest = self.__SW_MANIFEST as Array<PrecacheEntry | string>;

const PUBLIC_ROUTES = new Set(["/", "/modes", "/play/local"]);
const CACHE_VERSION = process.env.NEXT_PUBLIC_PWA_CACHE_VERSION ?? "v0.1.0";

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ sameOrigin, request, url }) =>
      sameOrigin && request.mode === "navigate" && PUBLIC_ROUTES.has(url.pathname),
    handler: new NetworkFirst({
      cacheName: `sharpener-fights-${CACHE_VERSION}-public-pages`,
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 3, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  {
    matcher: ({ sameOrigin, request, url }) =>
      sameOrigin && request.headers.get("RSC") === "1" && PUBLIC_ROUTES.has(url.pathname),
    handler: new NetworkFirst({
      cacheName: `sharpener-fights-${CACHE_VERSION}-public-rsc`,
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 7 * 24 * 60 * 60 })],
    }),
  },
  {
    matcher: ({ sameOrigin, request }) => sameOrigin && request.mode === "navigate",
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && ["/friend", "/queue", "/sign-in"].some((route) =>
        url.pathname === route || url.pathname.startsWith(`${route}/`),
      ),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && ["/invite/", "/play/"].some((prefix) =>
        url.pathname.startsWith(prefix) && url.pathname !== "/play/local",
      ),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && /\.(?:mp3|wav|ogg)$/i.test(url.pathname),
    handler: new CacheFirst({
      cacheName: `sharpener-fights-${CACHE_VERSION}-audio`,
      plugins: [
        new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        new RangeRequestsPlugin(),
      ],
    }),
  },
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: `sharpener-fights-${CACHE_VERSION}-next-static`,
      plugins: [new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  {
    matcher: ({ sameOrigin }) => !sameOrigin,
    handler: new NetworkOnly(),
  },
  {
    matcher: /.*/,
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  cacheId: `sharpener-fights-${CACHE_VERSION}`,
  precacheEntries: precacheManifest,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^gclid$/],
  },
  runtimeCaching,
  navigationPreload: true,
  skipWaiting: false,
  clientsClaim: false,
  disableDevLogs: true,
});

serwist.addEventListeners();
