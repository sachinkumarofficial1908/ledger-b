import { Router } from "express";
import { summaryReport, clientReport } from "../controllers/reportController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/summary", summaryReport);
router.get("/client/:id", clientReport);

export default router;
