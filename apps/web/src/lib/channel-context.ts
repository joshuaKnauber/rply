import { createContext, useContext } from "react";
import type { StoredChannel } from "./channels";

export const ChannelContext = createContext<StoredChannel | null>(null);
export const useChannelEntry = () => useContext(ChannelContext);
