import { Router, type IRouter } from "express";
import healthRouter from "./health";
import submissionsRouter from "./submissions";
import adminRouter from "./admin";
import controlRouter from "./control";

const router: IRouter = Router();

router.use(healthRouter);
router.use(submissionsRouter);
router.use(adminRouter);
router.use(controlRouter);

export default router;
