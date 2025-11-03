export const maxDuration = 60; // 设置此函数最长可运行 60 秒
export async function POST(request: Request) {
  try {
    const name = request.url.split("?")[1].split("=")[1];
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    console.log("-name---", name);
    if (!imageFile) {
      return new Response(JSON.stringify({ error: "No image file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 创建新的FormData发送给webhook
    const webhookFormData = new FormData();
    webhookFormData.append("image", imageFile);
    let webhookUrl = "";
    switch (name) {
      // 照片修复
      case "photo-restore":
        webhookUrl =
          "https://workflow.n8ndemo.com/webhook/b7c4294b-f0f5-48d7-8e07-99d560cc7e9a";
        break;
      // 服装穿搭
      case "photo-outfit":
        webhookUrl =
          "https://workflow.n8ndemo.com/webhook/521b085b-72fb-4dde-8793-a9526822da47";
        break;
      // 建筑转换等距图
      case "building-isometric":
        webhookUrl =
          "https://workflow.n8ndemo.com/webhook/f91a1400-5a6d-42bb-a152-dc946cc7b598";
        break;
      // 蓝图顶视图风格
      case "blueprint-top-view":
        webhookUrl =
          "https://workflow.n8ndemo.com/webhook/3eef0046-2c7a-4fb7-90d8-5631efa69538";
        break;
      // 桌面手办图
      case "figure-desk":
        webhookUrl =
          "https://workflow.n8ndemo.com/webhook/7b1c9036-c6fb-4435-9395-028b3aa5481e";
        break;
      // 装饰房间
      case "decorate-a-room":
        webhookUrl =
          "https://workflow.n8ndemo.com/webhook/aeea7e08-3af0-48c4-b3db-b79cb68c3509";
        break;
      // 照片转表情包
      case "photo-meme":
        webhookUrl =
          "https://workflow.n8ndemo.com/webhook/a9a5a1b7-1d7c-42a6-9696-7abc44bf5c24";
        break;
    }
    console.log("-name---", name);
    console.log("-webhookUrl---", webhookUrl);
    const res = await fetch(webhookUrl, {
      method: "POST",
      body: webhookFormData,
    });

    const data = await res.json();
    console.log("-webhook-response-", data);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing image:", error);
    return new Response(JSON.stringify({ error: "Failed to process image" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
