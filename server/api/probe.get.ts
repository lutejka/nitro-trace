import { defineHandler } from "nitro";
import { getProbeCounts } from "../utils/probe";

export default defineHandler(() => ({
  counts: getProbeCounts(),
  node: process.version,
  pid: process.pid,
}));
