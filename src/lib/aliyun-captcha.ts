import Client, * as $Captcha from "@alicloud/captcha20230305";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";

let captchaClient: Client | null = null;

function getCaptchaClient(): Client | null {
  const accessKeyId =
    process.env.ALIYUN_ACCESS_KEY_ID || process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret =
    process.env.ALIYUN_ACCESS_KEY_SECRET || process.env.OSS_ACCESS_KEY_SECRET;
  // 优先使用用户配置的端点，默认使用阿里云验证码 2.0 全国/全球统一接入点 captcha.aliyuncs.com
  const endpoint =
    process.env.ALIYUN_CAPTCHA_ENDPOINT || "captcha.aliyuncs.com";

  if (!accessKeyId || !accessKeySecret) {
    return null;
  }

  if (!captchaClient) {
    const config = new $OpenApi.Config({
      accessKeyId,
      accessKeySecret,
      endpoint,
      // 避免本地代理拦截 aliyuncs 域名导致的 TLS socket 断开
      noProxy: "aliyuncs.com,aliyun.com",
    });
    captchaClient = new Client(config);
  }

  return captchaClient;
}

/**
 * 校验阿里云验证码 2.0 前端返回的凭证 (captchaVerifyParam)
 * @param captchaVerifyParam 前端验证通过后生成的凭证字符串
 * @returns {Promise<{ success: boolean; message?: string }>}
 */
export async function verifyAliyunCaptcha(
  captchaVerifyParam?: string | null
): Promise<{ success: boolean; message?: string }> {
  const client = getCaptchaClient();

  // 若未配置阿里云密钥，属于未开启验证码环境（如开发/本地/轻量测试环境），自动降级放行
  if (!client) {
    return { success: true };
  }

  if (!captchaVerifyParam || typeof captchaVerifyParam !== "string") {
    return {
      success: false,
      message: "请先完成安全验证",
    };
  }

  try {
    const runtime = new $Util.RuntimeOptions({
      connectTimeout: 8000,
      readTimeout: 8000,
      autoretry: true,
      maxAttempts: 2,
    });

    // 1. 优先调用阿里云验证码 2.0 滑块/行为验证标准接口 VerifyCaptcha
    try {
      const captchaReq = new $Captcha.VerifyCaptchaRequest({
        captchaVerifyParam,
      });
      const res = await client.verifyCaptchaWithOptions(captchaReq, runtime);
      if (res?.body?.result?.verifyResult === true) {
        return { success: true };
      }
      if (res?.body?.result?.verifyResult === false) {
        return {
          success: false,
          message: res?.body?.message || "安全验证失败，请重新尝试",
        };
      }
    } catch (e: any) {
      // 若非普通校验不通过，尝试智能核验接口兜底
      const sceneId =
        process.env.ALIYUN_CAPTCHA_SCENE_ID ||
        process.env.NEXT_PUBLIC_ALIYUN_CAPTCHA_SCENE_ID;

      const intelligentReq = new $Captcha.VerifyIntelligentCaptchaRequest({
        captchaVerifyParam,
        sceneId: sceneId || undefined,
      });
      const intelRes = await client.verifyIntelligentCaptchaWithOptions(
        intelligentReq,
        runtime
      );
      if (intelRes?.body?.result?.verifyResult === true) {
        return { success: true };
      }
      return {
        success: false,
        message: intelRes?.body?.result?.verifyCode || "安全验证失败，请重新尝试",
      };
    }

    return {
      success: false,
      message: "安全验证失败，请重新尝试",
    };
  } catch (error: any) {
    console.error("[Aliyun Captcha] Verification error:", {
      message: error?.message,
      code: error?.code,
      data: error?.data,
    });

    const isRamAuthError =
      error?.code === "Forbidden.RAM" ||
      error?.message?.includes("AccessDenied") ||
      error?.message?.includes("Forbidden");

    const isNetworkError =
      error?.message?.includes("socket disconnected") ||
      error?.message?.includes("ECONNRESET") ||
      error?.message?.includes("ETIMEDOUT") ||
      error?.message?.includes("TLS");

    if (isRamAuthError) {
      return {
        success: false,
        message: "阿里云 RAM 账号未授权验证码权限 (AliyunYundunCaptchaFullAccess)",
      };
    }

    if (isNetworkError) {
      return {
        success: false,
        message: "无法连接阿里云验证码服务 (请检查本地网络代理/VPN)",
      };
    }

    return {
      success: false,
      message: error?.message || "验证码服务异常，请稍后重试",
    };
  }
}
