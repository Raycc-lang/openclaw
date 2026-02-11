// Canvas-host server functionality removed in miniAgent - stub for type compatibility
export type CanvasHostHandler = {
  rootDir: string;
  handleHttpRequest: (req: unknown, res: unknown) => Promise<boolean>;
};

export async function createCanvasHostHandler() {
  return {
    rootDir: "",
    handleHttpRequest: async () => false,
  };
}
