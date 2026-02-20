import { Router } from 'express';
import healthRouter from './healthRoutes';
import exampleRouter from './exampleRoutes';
import documentRouter from './documentRoutes';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/example', exampleRouter);
apiRouter.use('/documents', documentRouter);

export default apiRouter;
