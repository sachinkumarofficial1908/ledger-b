import User from "../models/User.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.accessToken;
  if (!token) throw new ApiError(401, "You must be logged in to do that.");

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, "Your session has expired. Please log in again.");
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, "Account not found.");
  if (!user.isActive) throw new ApiError(403, "This account has been deactivated.");

  req.user = user;
  next();
});
