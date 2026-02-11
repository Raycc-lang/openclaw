// Canvas-host server functionality removed in miniAgent - stub for compatibility
export async function createCanvasHostHandler() {
  return {
    rootDir: "",
    handleHttpRequest: async () => false,
  };
}
