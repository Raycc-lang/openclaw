declare module "bun" {
  export type TLSOptions = Record<string, unknown>;
  export type ServerWebSocket<T = unknown> = {
    data: T;
    send(data: string | ArrayBufferView | ArrayBuffer): void;
    close(code?: number, reason?: string): void;
    subscribe(topic: string): void;
    unsubscribe(topic: string): void;
    publish(topic: string, data: string | ArrayBufferView | ArrayBuffer): void;
  };
  export type Server<T = unknown> = {
    stop(closeActiveConnections?: boolean): void;
    publish(topic: string, data: string | ArrayBufferView | ArrayBuffer): void;
    subscriberCount(topic: string): number;
    requestIP?(req: Request): { address?: string } | null;
  };
}

declare module "bun:sqlite" {
  const BunSqliteModule: unknown;
  export = BunSqliteModule;
}

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
    json(): Promise<any>;
    exists(): Promise<boolean>;
    arrayBuffer(): Promise<ArrayBuffer>;
  };
  write(path: string, data: string | ArrayBufferView | ArrayBuffer): Promise<number>;
  serve<T = unknown>(options: Record<string, unknown>): import("bun").Server<T>;
};
