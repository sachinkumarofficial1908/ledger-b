import { Router } from "express";
import { summaryReport, clientReport, overviewReport } from "../controllers/reportController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/overview", overviewReport);
router.get("/summary", summaryReport);
router.get("/client/:id", clientReport);

export default router;
