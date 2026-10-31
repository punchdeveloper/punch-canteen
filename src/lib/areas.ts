/**
 * Which part of the app a URL belongs to, and its breadcrumb.
 *
 * v63 was one page with #hash "views". The rebuild uses real URLs:
 *
 *   staff side       /  /menu  /cart  /checkout  /orders  /account  /reviews  /chat
 *   sign-in          /login  /login/check-email           (staff side, no sidebar)
 *   portal pages     /portals  /operator/sign-in  /admin/sign-in
 *   operator portal  /operator  /operator/chat  /operator/menu
 *   admin portal     /admin
 *   other            /access-denied                       (staff side)
 *
 * The area decides the body classes the v63 CSS relies on (`staff`,
 * `login-view`), the sidebar navigation and the header label.
 */
export type Area = "staff" | "portal" | "operator" | "admin";

export function areaOf(pathname: string): Area {
  if (pathname === "/operator/sign-in" || pathname === "/admin/sign-in" || pathname === "/portals") return "portal";
  if (pathname === "/operator" || pathname.startsWith("/operator/")) return "operator";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  return "staff";
}

export const isLoginView = (pathname: string) => pathname === "/login" || pathname.startsWith("/login/");

/** Classes for <body>, exactly as v63 toggled them. */
export function bodyClassFor(pathname: string): string {
  const classes: string[] = [];
  if (areaOf(pathname) === "staff") classes.push("staff");
  if (isLoginView(pathname)) classes.push("login-view");
  return classes.join(" ");
}

const CRUMBS: Record<string, string> = {
  "/": "Home",
  "/menu": "Menu",
  "/cart": "Cart",
  "/checkout": "Checkout",
  "/orders": "My orders",
  "/account": "Staff account",
  "/reviews": "Reviews",
  "/chat": "Chat",
  "/login": "Staff login",
  "/login/check-email": "Activate account",
  "/portals": "Admin portals",
  "/access-denied": "Access restricted",
  "/operator/sign-in": "Canteen Operator login",
  "/admin/sign-in": "Canteen Admin login",
  "/operator": "Canteen Operator",
  "/operator/chat": "Canteen Chat",
  "/operator/menu": "Manage menu",
  "/admin": "Canteen Admin",
};

export const crumbFor = (pathname: string) => CRUMBS[pathname] ?? "";

/** Header label left of the breadcrumb. v63 said "ADMIN WORKSPACE" on operator pages too (N6). */
export function workspaceLabel(area: Area): string {
  if (area === "operator") return "OPERATOR WORKSPACE";
  if (area === "admin" || area === "portal") return "ADMIN WORKSPACE";
  return "PUNCH CANTEEN";
}

/** Sidebar heading. v63 showed "CANTEEN ADMIN" in the Operator portal (N6). */
export function navLabel(area: Area): string {
  if (area === "operator") return "CANTEEN OPERATOR";
  if (area === "admin" || area === "portal") return "CANTEEN ADMIN";
  return "STAFF ORDERING";
}
