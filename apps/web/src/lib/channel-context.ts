import { createContext, useContext } from "react";
import type { ChannelEntry, Message } from "@rply/schema";

export const ChannelContext = createContext<ChannelEntry | null>(null);
export const useChannelEntry = () => useContext(ChannelContext);

export const MessageContext = createContext<Message | null>(null);
export const useMessage = () => useContext(MessageContext);
