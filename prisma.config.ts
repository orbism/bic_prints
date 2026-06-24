import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

config(); // loads .env

export default defineConfig({
  datasource: {
    url: process.env.DB_DATABASE_URL!,
  },
});
