import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^1[3-9]\d{9}$/, "请输入合法的 11 位手机号码");

export const positiveInt = (fieldName = "数量") =>
  z.coerce
    .number({ invalid_type_error: `请输入有效的${fieldName}` })
    .int(`${fieldName}必须为整数`)
    .min(1, `${fieldName}必须大于 0`);

/**
 * 养殖户档案校验
 */
export const farmerFormSchema = z.object({
  name: z.string().trim().min(2, "养殖户姓名至少 2 个字符").max(20, "姓名不能超过 20 个字符"),
  phone: z.string().trim().optional(),
  farmType: z.string().default("LAKE_CRAB"),
  creditRating: z.enum(["A", "B", "C"], {
    errorMap: () => ({ message: "请选择信用等级" }),
  }),
  area: z.coerce
    .number({ invalid_type_error: "请输入有效的养殖面积数值" })
    .min(0.1, "养殖面积必须大于等于 0.1 亩")
    .max(10000, "养殖面积数值过大，请核实"),
  enclosuresStr: z.string().trim().min(1, "请至少填写一个围网编号"),
  status: z.enum(["ACTIVE", "SUSPENDED"]).default("ACTIVE"),
  contractName: z.string().trim().optional(),
  contractUrl: z.string().trim().optional(),
});
export type FarmerFormValues = z.infer<typeof farmerFormSchema>;

/**
 * 系统用户校验
 */
export const userFormSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "登录账号至少 3 个字符")
      .max(30, "登录账号最多 30 个字符")
      .regex(/^[a-zA-Z0-9_-]+$/, "账号仅支持英文、数字及下划线"),
    phone: phoneSchema,
    fullName: z.string().trim().min(2, "真实姓名至少 2 个字符").max(20, "姓名最多 20 个字符"),
    role: z.enum(["ADMIN", "QA_DIRECTOR", "WAREHOUSE_ADMIN", "FARMER_ADMIN", "CHANNEL_VIEWER"], {
      errorMap: () => ({ message: "请选择系统角色" }),
    }),
    channelId: z.string().optional(),
    password: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === "CHANNEL_VIEWER") {
        return Boolean(data.channelId && data.channelId.trim());
      }
      return true;
    },
    {
      message: "渠道审计人员必须绑定所属渠道",
      path: ["channelId"],
    }
  );
export type UserFormValues = z.infer<typeof userFormSchema>;

/**
 * 销售渠道校验
 */
export const channelFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "渠道编码至少 2 个字符")
    .max(20, "渠道编码最多 20 个字符")
    .regex(/^[A-Za-z0-9_-]+$/, "渠道编码仅支持英文字母、数字、短横线或下划线"),
  name: z.string().trim().min(2, "渠道名称至少 2 个字符").max(50, "渠道名称最多 50 个字符"),
});
export type ChannelFormValues = z.infer<typeof channelFormSchema>;

/**
 * 门店档案校验
 */
export const storeFormSchema = z.object({
  name: z.string().trim().min(2, "门店全称至少 2 个字符").max(60, "门店名称最多 60 个字符"),
  channelId: z.string().min(1, "请选择所属渠道"),
  isActive: z.boolean().default(true),
});
export type StoreFormValues = z.infer<typeof storeFormSchema>;

/**
 * 暂养池配置校验
 */
export const poolFormSchema = z.object({
  name: z.string().trim().min(2, "暂养池名称至少 2 个字符").max(30, "暂养池名称最多 30 个字符"),
});
export type PoolFormValues = z.infer<typeof poolFormSchema>;

/**
 * 原料入池登记校验
 */
export const batchIntakeFormSchema = z.object({
  farmerId: z.string().min(1, "请选择来源养殖户"),
  enclosureId: z.string().min(1, "请选择来源围网"),
  poolId: z.string().min(1, "请选择存放暂养池"),
  gender: z.enum(["MALE", "FEMALE"]),
  weightTier: z.string().min(1, "请选择重量档位规格"),
  inPoolCount: positiveInt("入池数量"),
  reportName: z.string().optional(),
  reportUrl: z.string().optional(),
  allowSpecialApproval: z.boolean().optional(),
  specialReason: z.string().optional(),
});
export type BatchIntakeFormValues = z.infer<typeof batchIntakeFormSchema>;

/**
 * 出库单与重提校验
 */
export const outboundOrderFormSchema = z.object({
  batchId: z.string().min(1, "请选择出库原料批次"),
  storeId: z.string().min(1, "请选择目标销售门店"),
  outboundCount: positiveInt("出库发运数量"),
});
export type OutboundOrderFormValues = z.infer<typeof outboundOrderFormSchema>;

export const resubmitOutboundFormSchema = z.object({
  storeId: z.string().min(1, "请选择目标销售门店"),
  outboundCount: positiveInt("修正出库数量"),
});
export type ResubmitOutboundFormValues = z.infer<typeof resubmitOutboundFormSchema>;

/**
 * 蟹扣领用与重提校验
 */
export const tagClaimFormSchema = z.object({
  farmerId: z.string().min(1, "请选择来源养殖户"),
  claimCount: positiveInt("领扣数量"),
});
export type TagClaimFormValues = z.infer<typeof tagClaimFormSchema>;

export const resubmitTagClaimFormSchema = z.object({
  claimCount: positiveInt("修正领扣数量"),
});
export type ResubmitTagClaimFormValues = z.infer<typeof resubmitTagClaimFormSchema>;

export const settleTagClaimFormSchema = z.object({
  returnedCount: z.coerce.number().int().min(0, "退回数量不能为负数").default(0),
  returnReason: z.string().optional(),
  scrappedCount: z.coerce.number().int().min(0, "作废数量不能为负数").default(0),
  scrapReason: z.string().optional(),
});
export type SettleTagClaimFormValues = z.infer<typeof settleTagClaimFormSchema>;

/**
 * 损耗盘点校验
 */
export const lossRegisterFormSchema = z.object({
  physicalCount: z.coerce
    .number({ invalid_type_error: "请输入有效的实盘点数" })
    .int("实盘数量必须为整数")
    .min(0, "实盘数量不能为负数"),
  reason: z.string().optional(),
});
export type LossRegisterFormValues = z.infer<typeof lossRegisterFormSchema>;

/**
 * 物流单号回填校验
 */
export const logisticsFormSchema = z.object({
  logisticsNo: z
    .string()
    .trim()
    .min(6, "物流单号格式不正确，至少 6 位")
    .max(40, "物流单号不能超过 40 位")
    .regex(/^[A-Za-z0-9_-]+$/, "物流单号仅支持英文、数字及连字符"),
});
export type LogisticsFormValues = z.infer<typeof logisticsFormSchema>;

/**
 * 修改个人密码校验
 */
export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入原密码"),
    newPassword: z.string().min(6, "新密码长度不能少于 6 位").max(32, "新密码长度不能超过 32 位"),
    confirmPassword: z.string().min(1, "请再次输入新密码"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "两次输入的新密码不一致",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "新密码不能与原密码相同",
    path: ["newPassword"],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
