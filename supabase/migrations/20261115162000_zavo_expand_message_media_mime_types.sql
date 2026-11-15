-- Allow common mobile image and video formats in private direct-message storage.
-- Keep the bucket private and retain the existing 50 MiB per-file limit.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif',
  'video/mp4','video/webm','video/quicktime','video/3gpp','video/x-m4v','video/x-matroska','video/x-msvideo','video/mpeg',
  'audio/webm','audio/ogg','audio/mp4','audio/mpeg'
]
where id = 'zavo-message-media';
