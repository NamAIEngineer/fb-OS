/**
 * Route inventory used by the independent verifier.
 *
 * `publicCandidate` means the route may render without an authenticated
 * session. The capture records an anonymous redirect as evidence; it never
 * attempts a login.
 */
export const VIEWPORTS = Object.freeze([
  Object.freeze({ id: "desktop", width: 1440, height: 900 }),
  Object.freeze({ id: "mobile", width: 390, height: 844 }),
]);

export const ROUTES = Object.freeze([
  { id: "post", path: "/post", publicCandidate: true, acceptance: ["A2", "A3", "A4", "A7"] },
  { id: "plans", path: "/plans", publicCandidate: true, acceptance: ["A5"] },
  { id: "login", path: "/login", publicCandidate: true, acceptance: ["A6"] },
  { id: "register", path: "/register", publicCandidate: true, acceptance: ["A6"] },
  { id: "join-group", path: "/join-group", acceptance: ["A4", "A7"] },
  { id: "bump", path: "/bump", acceptance: ["A3", "A7"] },
  { id: "interact", path: "/interact", acceptance: ["A4", "A7"] },
  { id: "auto-comment", path: "/auto-comment", acceptance: ["A4", "A7"] },
  { id: "auto-approve", path: "/auto-approve", acceptance: ["A4", "A7"] },
  { id: "accounts", path: "/accounts", acceptance: ["A2", "A4", "A7"] },
  { id: "affiliate", path: "/affiliate", acceptance: ["A6", "A7"] },
  { id: "profile", path: "/profile", acceptance: ["A6", "A7"] },
  { id: "post-templates", path: "/post-templates", acceptance: ["A2", "A3", "A7"] },
  { id: "group-collections", path: "/group-collections", acceptance: ["A2", "A3", "A4", "A7"] },
  { id: "comment-collections", path: "/comment-collections", acceptance: ["A3", "A4", "A7"] },
  { id: "friend-collections", path: "/friend-collections", acceptance: ["A4", "A7"] },
  { id: "auto-comment-script-templates", path: "/auto-comment-script-templates", acceptance: ["A4", "A7"] },
  { id: "pending", path: "/pending", acceptance: ["A3", "A7"] },
  { id: "fulfilled", path: "/fulfilled", acceptance: ["A3", "A7"] },
  { id: "rejected", path: "/rejected", acceptance: ["A3", "A7"] },
  {
    id: "search-customers",
    path: "/search-customers",
    deferred: true,
    excluded: true,
    acceptance: ["A9"],
  },
]);

export const BASELINE_ROUTES = Object.freeze(ROUTES.filter((route) => route.publicCandidate));
export const PRODUCT_ROUTES = Object.freeze(ROUTES.filter((route) => !route.deferred));

export function routeUrl(baseUrl, route) {
  return new URL(route.path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}
