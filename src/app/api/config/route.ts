import { NextResponse } from "next/server";

export async function GET() {
  const hasAws = !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION &&
    process.env.AWS_S3_BUCKET
  );
  return NextResponse.json({ hasAws });
}
