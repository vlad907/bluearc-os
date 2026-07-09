import path from "node:path";
import { defineConfig } from "prisma/config";

(process as typeof process & { loadEnvFile?: (path?: string) => void }).loadEnvFile?.(".env");

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
