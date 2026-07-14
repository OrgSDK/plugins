/**
 * Minimal structural store + logger interfaces for plugin authoring.
 *
 * These are structural types — the daemon injects real store/logger instances
 * at load time via PluginFactory(ctx). Plugins never construct these; they
 * only consume them through PluginContext. No runtime code is exported here.
 */

/** Opaque credential secret bundle injected into safe-function handlers. */
export type CredentialSecretBundle = Record<string, unknown>;

/** Credential metadata stored alongside secrets (label, validity, scopes). */
export interface CredentialMetadata {
	provider: string;
	name: string;
	label?: string;
	valid?: boolean;
	scopes?: string[];
	source?: string;
	createdAt?: Date;
	updatedAt?: Date | null;
	[key: string]: unknown;
}

/**
 * Structural credential store interface. Resolves secrets + metadata by
 * provider + name. Plugin code reads through this; the daemon provides the
 * real Postgres-backed implementation at runtime.
 */
export interface CredentialStore {
	get(provider: string, name: string): Promise<CredentialMetadata | null>;
	list(): Promise<CredentialMetadata[]>;
	upsert(entry: Omit<CredentialMetadata, "createdAt">): Promise<void>;
	delete(provider: string, name: string): Promise<void>;
	getSecrets(
		provider: string,
		name: string,
	): Promise<CredentialSecretBundle | null>;
	setSecrets(
		provider: string,
		name: string,
		secrets: CredentialSecretBundle,
		metadata?: Partial<
			Omit<CredentialMetadata, "provider" | "name" | "createdAt">
		>,
	): Promise<void>;
}

/** A tenant-config row (key → JSON value). */
export interface TenantConfigEntry {
	key: string;
	value: Record<string, unknown>;
	updatedAt: Date | null;
}

/** Structural config store for non-secret plugin settings (tenant_config). */
export interface ConfigStore {
	list(): Promise<TenantConfigEntry[]>;
	get(key: string): Promise<TenantConfigEntry | null>;
	set(key: string, value: Record<string, unknown>): Promise<TenantConfigEntry>;
	delete(key: string): Promise<void>;
}

/**
 * Minimal structured logger. Mirrors the pino method surface that plugins
 * use. The daemon injects a real pino instance at runtime; plugins should
 * not depend on pino directly.
 */
export interface PluginLogger {
	trace(msg: string, ...args: unknown[]): void;
	debug(msg: string, ...args: unknown[]): void;
	info(msg: string, ...args: unknown[]): void;
	warn(msg: string, ...args: unknown[]): void;
	error(msg: string, ...args: unknown[]): void;
	fatal(msg: string, ...args: unknown[]): void;
	child(bindings: Record<string, unknown>): PluginLogger;
}
