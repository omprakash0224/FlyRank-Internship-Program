import { Router } from 'express';
import * as widgetRepo from '../../repositories/widget.js';
import { asyncHandler, NotFoundError } from '../../utils/errors.js';
import { publicCors } from '../../middleware/cors.js';

export const configRouter = Router();

// ─── GET /widgets/:id/config ──────────────────────────────────────────────────
//
// Returns the public widget configuration payload.
//
// Cache strategy:
//   • ETag = "v{version}" — allows conditional GET (304 Not Modified)
//   • Cache-Control: public, max-age=300 — CDNs/browsers cache for 5 minutes
//   • Vary: Origin — required when CORS + caching coexist
//
// The version field in the widget record is incremented on every admin update,
// so updating a widget naturally busts any CDN caches referencing the old ETag.
//

configRouter.options('/widgets/:id/config', publicCors);

configRouter.get(
  '/widgets/:id/config',
  publicCors,
  asyncHandler(async (req, res) => {
    const widget = await widgetRepo.findWidgetById(req.params.id);

    if (!widget || !widget.isActive) {
      throw new NotFoundError('Widget');
    }

    // Build the ETag from the widget's version
    const etag = `"v${widget.version}"`;

    // Conditional GET — if the client already has this version, send 304
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).send();
    }

    // Shape the public config — only expose what the embed script needs
    const config = {
      id: widget.id,
      version: widget.version,
      type: widget.type,
      ...(widget.config ?? {}),
    };

    res
      .set('ETag', etag)
      .set('Cache-Control', 'public, max-age=300')
      .set('Vary', 'Origin')
      .json(config);
  })
);
