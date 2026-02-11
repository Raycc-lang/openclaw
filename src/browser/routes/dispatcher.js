// Browser route dispatcher functionality removed in miniAgent - stub for compatibility
export function createBrowserRouteDispatcher() {
  return {
    dispatch: async () => {
      throw new Error("Browser functionality removed in miniAgent");
    },
  };
}
