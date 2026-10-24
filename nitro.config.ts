import { defineConfig } from "nitro";

export default defineConfig({
  // Nitro 3 requires an explicit server directory (the default is `false`).
  serverDir: true,

  // Instrument the h3, srvx and unstorage tracing channels.
  tracingChannel: true,
});
