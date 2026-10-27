/** Keep upload authorization independent from existing login credentials. */
export function wanUploadSigningKey() {
  const secret =
    process.env.WAN_UPLOAD_SIGNING_SECRET ?? process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('not_configured');
  return secret;
}
