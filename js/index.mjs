/**
 * ESM entry point for the `weinc` package. Re-exports the CommonJS
 * implementation so both `import` and `require` consumers get the same code.
 */
import cjs from "./index.cjs";

export const { WeIncClient, WeIncError, DEFAULT_BASE_URL } = cjs;
export default cjs;
