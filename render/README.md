# Clip render service

Executes Clip Editor's approved edit plan (cuts, 9:16 crop, burned-in captions) with ffmpeg.
The Worker builds the ffmpeg arguments (`worker/lib/render.ts`, tested). This service only downloads, runs and uploads.

## What's left before it's live

1. Deploy this folder as a Cloudflare Container, or on any Docker host, and note its URL.
2. Set these Worker secrets: `RENDER_URL` (the service URL), `RENDER_SECRET` (any long random string; set the same value on the container) and `CLIP_RENDER=on`.
3. Approve an edit in Content → Studio and tap **Render**. The clip shows "Rendered" and the Publisher posts the rendered file.

With `CLIP_RENDER` off, nothing changes: the plan is saved and the Publisher posts the uploaded file.

Higgsfield's reframe and upscale can be layered on later. Its API had no verified endpoint for cutting ranges or burning captions, so this service does that part.
