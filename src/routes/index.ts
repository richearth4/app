import { Router } from 'express';
import healthRouter from './healthRoutes';
import exampleRouter from './exampleRoutes';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/example', exampleRouter);

export default apiRouter;
