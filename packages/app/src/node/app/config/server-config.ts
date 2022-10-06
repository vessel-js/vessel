export type ResolvedServerConfig = {
  config: {
    /**
     * Globs used to discover edge server configuration file.
     */
    edge: string[];
    /**
     * Globs used to discover node server configuration file.
     */
    node: string[];
    /**
     * Globs used to discover shared (edge/node) server configuration file.
     */
    shared: string[];
  };
};

export type ServerConfig = {
  config?: Partial<ResolvedServerConfig['config']>;
};
