import { createContext, useContext } from "react";

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

export { AppCtx, useApp };