import dotenv from 'dotenv';
import { app } from './app';
import { prisma } from './db';

dotenv.config();

const port = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
  });
}

export { prisma };
export default app;

