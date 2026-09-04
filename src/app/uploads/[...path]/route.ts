import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: segments = [] } = await params;
  if (!segments.length || segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const filename = segments.join("/");
  const uploadDirs = [
    path.join(process.cwd(), "public", "uploads"),
    path.join(process.cwd(), "data", "uploads"),
  ];

  for (const dir of uploadDirs) {
    try {
      const file = await fs.readFile(path.join(dir, filename));
      const ext = path.extname(filename).toLowerCase();
      return new NextResponse(new Uint8Array(file), {
        headers: {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // ponytail: 文件未在当前目录找到，尝试下一个候选目录
    }
  }

  return new NextResponse("Not Found", { status: 404 });
}
