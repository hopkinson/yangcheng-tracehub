"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { deleteFileFromStorage, uploadFileToStorage } from "@/lib/storage";
import { inspectionReportFormSchema } from "@/lib/validations/schemas";

const REPORT_ROLES = ["QA_DIRECTOR", "ADMIN", "WAREHOUSE_ADMIN"];
const REPORT_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);
const REPORT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function parseInspectedAt(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00+08:00`);
  if (Number.isNaN(date.getTime())) throw new Error("检测时间格式无效");
  return date;
}

export async function createInspectionReportAction(formData: FormData) {
  const operator = await requireRole(REPORT_ROLES);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) throw new Error("请选择检测报告附件");
  if (file.size > 10 * 1024 * 1024) throw new Error("报告附件不能超过 10MB");

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!REPORT_EXTENSIONS.has(extension) || (file.type && !REPORT_MIME_TYPES.has(file.type))) {
    throw new Error("仅支持 PDF、JPG、PNG 格式的检测报告");
  }

  const parsed = inspectionReportFormSchema.safeParse({
    name: formData.get("name"),
    inspectedAt: formData.get("inspectedAt") || "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "报告信息填写有误");

  const uploaded = await uploadFileToStorage(file);

  try {
    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.inspectionReport.create({
        data: {
          name: parsed.data.name,
          fileUrl: uploaded.url,
          fileName: uploaded.name,
          inspectedAt: parseInspectedAt(parsed.data.inspectedAt),
          uploadedById: operator.id,
        },
      });

      await tx.auditLog.create({
        data: {
          operatorId: operator.id,
          action: "INSPECTION_REPORT_CREATE",
          entityType: "INSPECTION_REPORT",
          entityId: created.id,
          details: JSON.stringify({ name: created.name, fileName: created.fileName }),
        },
      });

      return created;
    });

    revalidatePath("/reports");
    return { success: true, id: report.id };
  } catch (error) {
    await deleteFileFromStorage(uploaded.url);
    throw error;
  }
}

export async function updateInspectionReportAction(data: {
  id: string;
  name: string;
  inspectedAt?: string;
}) {
  const operator = await requireRole(REPORT_ROLES);
  const parsed = inspectionReportFormSchema.safeParse({
    name: data.name,
    inspectedAt: data.inspectedAt || "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "报告信息填写有误");

  await prisma.$transaction(async (tx) => {
    const existing = await tx.inspectionReport.findUniqueOrThrow({ where: { id: data.id } });

    await tx.inspectionReport.update({
      where: { id: data.id },
      data: {
        name: parsed.data.name,
        inspectedAt: parseInspectedAt(parsed.data.inspectedAt),
      },
    });

    await tx.auditLog.create({
      data: {
        operatorId: operator.id,
        action: "INSPECTION_REPORT_UPDATE",
        entityType: "INSPECTION_REPORT",
        entityId: data.id,
        details: JSON.stringify({ beforeName: existing.name, name: parsed.data.name }),
      },
    });
  });

  revalidatePath("/reports");
  return { success: true };
}

export async function deleteInspectionReportAction(id: string) {
  const operator = await requireRole(REPORT_ROLES);

  const report = await prisma.$transaction(async (tx) => {
    const existing = await tx.inspectionReport.findUniqueOrThrow({ where: { id } });

    await tx.auditLog.create({
      data: {
        operatorId: operator.id,
        action: "INSPECTION_REPORT_DELETE",
        entityType: "INSPECTION_REPORT",
        entityId: existing.id,
        details: JSON.stringify({ name: existing.name, fileName: existing.fileName }),
      },
    });

    await tx.inspectionReport.delete({ where: { id } });
    return existing;
  });

  await deleteFileFromStorage(report.fileUrl);
  revalidatePath("/reports");
  return { success: true };
}
