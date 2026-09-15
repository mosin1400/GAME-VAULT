"use client";

import { createContext, useContext } from "react";
import type { NodeDefinition } from "@/lib/workflow/types";

export const NodeDefsContext = createContext<Map<string, NodeDefinition>>(new Map());
export const useNodeDefs = () => useContext(NodeDefsContext);
