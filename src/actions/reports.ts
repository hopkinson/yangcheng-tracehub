"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { deleteFileFromStorage, uploadFileToStorage } from "@/lib/storage";
import { inspectionReportFormSchema } from "@/lib/validations/schemas";

const REPORT_ROLES = ["QA_DIRECTOR", "ADMIN", "WAREHOUSE_ADMIN"];
const REPORT_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);
const REPORT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function validateAttachment(file: File, label: string) {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${label}不能超过 10MB`);
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!REPORT_EXTENSIONS.has(extension) || (file.type && !REPORT_MIME_TYPES.has(file.type))) {
    throw new Error(`${label}仅支持 PDF、JPG、PNG 格式`);
  }
}

function parseInspectedAt(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00+08:00`);
  if (Number.isNaN(date.getTime())) throw new Error("检测时间格式无效");
  return date;
}

export async function createInspectionReportAction(formData: FormData) {
  const operator = await requireRole(REPORT_ROLES);
  const file = formData.get("file");
  const licenseFileValue = formData.get("licenseFile");

  if (!(file instanceof File) || file.size === 0) throw new Error("请选择检测报告附件");
  validateAttachment(file, "报告附件");

  if (licenseFileValue !== null && !(licenseFileValue instanceof File)) throw new Error("营业执照附件格式无效");
  const licenseFile = licenseFileValue instanceof File && licenseFileValue.size > 0 ? licenseFileValue : null;
  if (licenseFile) validateAttachment(licenseFile, "营业执照");

  const parsed = inspectionReportFormSchema.safeParse({
    name: formData.get("name"),
    inspectedAt: formData.get("inspectedAt") || "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "报告信息填写有误");

  const uploaded = await uploadFileToStorage(file);
  let uploadedLicense: Awaited<ReturnType<typeof uploadFileToStorage>> | null = null;
  let reportId: string;

  try {
    if (licenseFile) uploadedLicense = await uploadFileToStorage(licenseFile);

    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.inspectionReport.create({
        data: {
          name: parsed.data.name,
          fileUrl: uploaded.url,
          fileName: uploaded.name,
          licenseUrl: uploadedLicense?.url ?? null,
          licenseName: uploadedLicense?.name ?? null,
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
          details: JSON.stringify({ name: created.name, fileName: created.fileName, licenseName: created.licenseName }),
        },
      });

      return created;
    });
    reportId = report.id;
  } catch (error) {
    await deleteFileFromStorage(uploaded.url);
    if (uploadedLicense) await deleteFileFromStorage(uploadedLicense.url);
    throw error;
  }

  revalidatePath("/reports");
  return { success: true, id: reportId };
}

export async function updateInspectionReportAction(formData: FormData) {
  const operator = await requireRole(REPORT_ROLES);
  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("报告 ID 无效");

  const parsed = inspectionReportFormSchema.safeParse({
    name: formData.get("name"),
    inspectedAt: formData.get("inspectedAt") || "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "报告信息填写有误");

  const licenseFileValue = formData.get("licenseFile");
  if (licenseFileValue !== null && !(licenseFileValue instanceof File)) {
    throw new Error("营业执照附件格式无效");
  }
  const licenseFile = licenseFileValue instanceof File && licenseFileValue.size > 0 ? licenseFileValue : null;
  if (licenseFile) validateAttachment(licenseFile, "营业执照");

  const removeLicense = formData.get("removeLicense") === "true";

  let uploadedLicense: Awaited<ReturnType<typeof uploadFileToStorage>> | null = null;
  if (licenseFile) {
    uploadedLicense = await uploadFileToStorage(licenseFile);
  }

  let oldLicenseUrlToDelete: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.inspectionReport.findUniqueOrThrow({ where: { id } });

      const updateData: {
        name: string;
        inspectedAt: Date | null;
        licenseUrl?: string | null;
        licenseName?: string | null;
      } = {
        name: parsed.data.name,
        inspectedAt: parseInspectedAt(parsed.data.inspectedAt),
      };

      if (uploadedLicense || removeLicense) {
        updateData.licenseUrl = uploadedLicense?.url ?? null;
        updateData.licenseName = uploadedLicense?.name ?? null;
        if (existing.licenseUrl) oldLicenseUrlToDelete = existing.licenseUrl;
      }

      await tx.inspectionReport.update({
        where: { id },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          operatorId: operator.id,
          action: "INSPECTION_REPORT_UPDATE",
          entityType: "INSPECTION_REPORT",
          entityId: id,
          details: JSON.stringify({
            beforeName: existing.name,
            name: parsed.data.name,
            licenseChanged: Boolean(uploadedLicense || removeLicense),
            beforeLicenseName: existing.licenseName,
            licenseName: updateData.licenseName ?? existing.licenseName,
          }),
        },
      });
    });

    if (oldLicenseUrlToDelete) {
      await deleteFileFromStorage(oldLicenseUrlToDelete);
    }
  } catch (error) {
    if (uploadedLicense) {
      await deleteFileFromStorage(uploadedLicense.url);
    }
    throw error;
  }

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
        details: JSON.stringify({ name: existing.name, fileName: existing.fileName, licenseName: existing.licenseName }),
      },
    });

    await tx.inspectionReport.delete({ where: { id } });
    return existing;
  });

  await deleteFileFromStorage(report.fileUrl);
  if (report.licenseUrl) await deleteFileFromStorage(report.licenseUrl);
  revalidatePath("/reports");
  return { success: true };
}
