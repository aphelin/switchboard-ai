import type { EmbeddingProviderName, LlmProviderName } from './llm-presets';

export interface AppCorsConfiguration {
  /** Browser origins allowed to call the API with credentials. */
  origin: string[];
  credentials: boolean;
}

export interface AppConfig {
  port: number;
  /** Public origin of this API, used to build absolute URLs (e.g. stored image URLs). */
  publicUrl: string;
  cors: AppCorsConfiguration;
}

export interface DatabaseConfig {
  url: string;
}

export interface RedisConfig {
  host: string;
  port: number;
}

export interface PollinationsConfig {
  apiKey: string;
  baseUrl: string;
}

export interface StorageConfig {
  dir: string;
}

export interface LlmProviderConfig {
  name: LlmProviderName;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LlmConfig {
  primary: LlmProviderConfig;
  fallback?: LlmProviderConfig;
  /** Model used for cheap, low-stakes tasks (prompt enhancement, titles). */
  fastModel: string;
  /** Optional pricing override, USD per 1M tokens: {"model-id": {"input": 0.15, "output": 0.6}} */
  pricingJson?: string;
}

export interface EmbeddingConfig {
  provider: EmbeddingProviderName;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  cacheDir: string;
  /** Must match the vector(N) column size in prisma/schema.prisma. */
  dimensions: number;
}

export interface AuthConfig {
  secret: string;
  /** Origin Better Auth runs on (this API). */
  baseUrl: string;
  /** Browser origins allowed to call auth endpoints with cookies (CSRF protection). */
  trustedOrigins: string[];
  /** Per-user daily AI spend limit in USD; null = unlimited. */
  dailyBudgetUsd: number | null;
  /** First account created claims rows that have no owner (rows from before auth). */
  claimLegacyData: boolean;
}

export interface DemoConfig {
  /** Visitors can open a guest session in one click, without an account. */
  enabled: boolean;
  /** Account whose documents, generations, chats and traces every new guest starts with; null = guests start empty. */
  templateEmail: string | null;
  /** Guests and everything they created are deleted this many hours after sign-in. */
  guestTtlHours: number;
  /** Daily AI spend limit per guest in USD; null = unlimited. */
  guestDailyBudgetUsd: number | null;
  /** Daily AI spend limit for all guests together in USD, protecting the shared platform key; null = unlimited. */
  totalDailyBudgetUsd: number | null;
  /** New guest sessions allowed per day (UTC), across all visitors. */
  maxGuestsPerDay: number;
}

export interface CredentialsConfig {
  /** Base64 AES-256 key for users' provider API keys; null disables bring-your-own-key. */
  encryptionKey: string | null;
}

export interface AppConfiguration {
  app: AppConfig;
  credentials: CredentialsConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  pollinations: PollinationsConfig;
  storage: StorageConfig;
  llm: LlmConfig;
  embedding: EmbeddingConfig;
  auth: AuthConfig;
  demo: DemoConfig;
}
