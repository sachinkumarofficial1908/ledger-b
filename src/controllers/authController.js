import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from "../utils/tokens.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip;

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password +failedLoginAttempts +lockUntil +tokenVersion"
  );

  if (!user) {
    await recordAudit({ action: "LOGIN_FAILED", entityType: "User", ipAddress, newValue: { email } });
    throw new ApiError(401, "Invalid email or password.");
  }

  if (user.isLocked()) {
    throw new ApiError(423, "This account is temporarily locked due to repeated failed attempts. Try again later.");
  }

  if (!user.isActive) {
    throw new ApiError(403, "This account has been deactivated.");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }
    await user.save({ validateBeforeSave: false });
    await recordAudit({
      action: "LOGIN_FAILED",
      entityType: "User",
      entityId: user._id,
      performedBy: user._id,
      ipAddress,
    });
    throw new ApiError(401, "Invalid email or password.");
  }

  // Successful login — reset lockout bookkeeping
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save({ validateBeforeSave: false });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setAuthCookies(res, accessToken, refreshToken);

  await recordAudit({
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: user._id,
    performedBy: user._id,
    ipAddress,
  });

  res.json({ success: true, data: { user: user.toJSON() } });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await User.findByIdAndUpdate(payload.sub, { $inc: { tokenVersion: 1 } });
    } catch {
      // Token already invalid/expired — nothing to invalidate
    }
  }
  clearAuthCookies(res);
  res.json({ success: true, message: "Logged out." });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new ApiError(401, "No refresh token provided.");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearAuthCookies(res);
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  const user = await User.findById(payload.sub).select("+tokenVersion");
  if (!user || !user.isActive) {
    clearAuthCookies(res);
    throw new ApiError(401, "Session no longer valid.");
  }
  if ((user.tokenVersion || 0) !== payload.tokenVersion) {
    clearAuthCookies(res);
    throw new ApiError(401, "Session no longer valid. Please log in again.");
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setAuthCookies(res, accessToken, refreshToken);

  res.json({ success: true, message: "Session refreshed." });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toJSON() } });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password +tokenVersion");

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError(401, "Current password is incorrect.");

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1; // invalidate existing refresh tokens
  await user.save();

  clearAuthCookies(res);
  res.json({ success: true, message: "Password changed. Please log in again." });
});
