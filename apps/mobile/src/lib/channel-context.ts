import { createContext, useContext } from "react";
import type { Message } from "@rply/schema";
import type { StoredChannel } from "./channels";

export const ChannelContext = createContext<StoredChannel | null>(null);
export const useChannelEntry = () => useContext(ChannelContext);

export const MessageContext = createContext<Message | null>(null);
export const useMessage = () => useContext(MessageContext);
