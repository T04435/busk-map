import { appVersion } from "@/lib/version";
// No `dynamic = "force-static"`: it is not allowed with cacheComponents. A GET with no request data is static by default.
export function GET() {
  return Response.json({ ...appVersion, deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null });
}
