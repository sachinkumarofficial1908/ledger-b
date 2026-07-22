import IdempotencyKey from "../models/IdempotencyKey.js";
import { logger } from "../utils/logger.js";

/**
 * Protects a write endpoint against duplicate submission (retried requests
 * from flaky mobile networks, double-tapped submit buttons, etc.).
 *
 * Contract: the client sends an `Idempotency-Key` header (any unique string,
 * e.g. a UUID generated once per form submission). First request with that
 * key executes normally; any repeat of the same key replays the original
 * response instead of creating a second transaction.
 *
 * The header is optional — omitting it just skips this protection, it
 * doesn't block the request. This mirrors how Stripe's API works.
 */
export function idempotent(scope) {
  return async function idempotencyMiddleware(req, res, next) {
    const key = req.get("Idempotency-Key");
    if (!key) return next(); // no key supplied — proceed without protection

    try {
      const existing = await IdempotencyKey.findOne({ key, scope });
      if (existing) {
        res.setHeader("Idempotent-Replay", "true");
        return res.status(existing.statusCode).json(existing.responseBody);
      }
    } catch (err) {
      logger.error(`Idempotency lookup failed: ${err.message}`);
      return next(); // fail open rather than blocking a legitimate request
    }

    // Capture the outgoing response so it can be replayed on a retry
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      IdempotencyKey.create({
        key,
        scope,
        userId: req.user?._id,
        statusCode: res.statusCode,
        responseBody: body,
      }).catch((err) => {
        // Duplicate key error (11000) means a concurrent identical request
        // won the race and already stored a response — that's fine, the
        // stored copy is what matters, not this one.
        if (err.code !== 11000) {
          logger.error(`Failed to record idempotency key: ${err.message}`);
        }
      });
      return originalJson(body);
    };

    next();
  };
}
