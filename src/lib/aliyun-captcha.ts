import Client, * as $Captcha from "@alicloud/captcha20230305";
import * as $OpenApi from "@alicloud/openapi-client";
import * as $Util from "@alicloud/tea-util";

let captchaClient: Client | null = null;

function getCaptchaClient(): Client | null {
  const accessKeyId =
    process.env.ALIYUN_ACCESS_KEY_ID || process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret =
    process.env.ALIYUN_ACCESS_KEY_SECRET || process.env.OSS_ACCESS_KEY_SECRET;
  const endpoint =
    process.env.ALIYUN_CAPTCHA_ENDPOINT || "captcha.cn-hangzhou.aliyuncs.com";

  if (!accessKeyId || !accessKeySecret) {
    return null;
  }

  if (!captchaClient) {
    const config = new $OpenApi.Config({
      accessKeyId,
      accessKeySecret,
      endpoint,
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
    const sceneId =
      process.env.ALIYUN_CAPTCHA_SCENE_ID ||
      process.env.NEXT_PUBLIC_ALIYUN_CAPTCHA_SCENE_ID;

    const request = new $Captcha.VerifyIntelligentCaptchaRequest({
      captchaVerifyParam,
      sceneId: sceneId || undefined,
    });

    const runtime = new $Util.RuntimeOptions({});
    const response = await client.verifyIntelligentCaptchaWithOptions(
      request,
      runtime
    );

    const body = response?.body;

    // VerifyResult: true 表示验证通过；false 表示验证未通过
    if (body?.result?.verifyResult === true) {
      return { success: true };
    }

    return {
      success: false,
      message: body?.result?.verifyCode || "安全验证失败，请重新尝试",
    };
  } catch (error) {
    console.error("[Aliyun Captcha] Verification error:", error);
    return {
      success: false,
      message: "验证码服务异常，请稍后重试",
    };
  }
}
