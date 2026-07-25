import jwt from "jsonwebtoken";
import { getCookieOptions } from "../config/security.js";
import { env } from "../config/env.js";

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), tokenVersion: user.tokenVersion || 0 },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

export const accessCookieOptions = getCookieOptions({ path: "/", maxAge: 15 * 60 * 1000 });

export const refreshCookieOptions = getCookieOptions({
  path: "/api/auth", // only sent to auth routes (refresh/logout)
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

export function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
}

function clearOptions(options) {
  const { maxAge, ...rest } = options;
  return rest;
}

export function clearAuthCookies(res) {
  res.clearCookie("accessToken", clearOptions(accessCookieOptions));
  res.clearCookie("refreshToken", clearOptions(refreshCookieOptions));
}
