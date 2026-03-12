export interface AppCorsConfiguration {
  origin: string;
  credentials: boolean;
}

export interface AppConfig {
  port: number;
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

export interface AppConfiguration {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  pollinations: PollinationsConfig;
}
