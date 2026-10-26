import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// No incremental cache: every page is dynamic.
export default defineCloudflareConfig({});
