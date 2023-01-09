export interface ResolvedClientConfig {
  /**
   * Application module ID or file path relative to `<root>`.
   */
  app: string;
}

export interface ClientConfig extends Partial<ResolvedClientConfig> {}
