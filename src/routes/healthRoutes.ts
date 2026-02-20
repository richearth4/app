import { Router } from 'express';
import { getHealthStatus } from '../controllers/healthController';

const healthRouter = Router();

healthRouter.get('/', getHealthStatus);

export default healthRouter;
