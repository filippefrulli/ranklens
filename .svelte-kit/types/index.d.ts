type DynamicRoutes = {
	
};

type Layouts = {
	"/": undefined;
	"/auth": undefined;
	"/auth/callback": undefined;
	"/auth/login": undefined
};

export type RouteId = "/" | "/auth" | "/auth/callback" | "/auth/login";

export type RouteParams<T extends RouteId> = T extends keyof DynamicRoutes ? DynamicRoutes[T] : Record<string, never>;

export type LayoutParams<T extends RouteId> = Layouts[T] | Record<string, never>;

export type Pathname = "/" | "/auth" | "/auth/callback" | "/auth/login";

export type ResolvedPathname = `${"" | `/${string}`}${Pathname}`;

export type Asset = never;