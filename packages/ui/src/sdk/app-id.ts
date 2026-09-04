import { createContext } from "react";

/**
 * App id injected by `<AppRuntime>`. Its own module so the error boundary can read it
 * without importing `use-app` (which would make the two mutually dependent).
 */
export const AppIdContext = createContext("");
