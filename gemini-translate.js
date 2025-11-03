const path = require('path');
const dotenv = require('dotenv');

// 首先加载 .env.local 文件
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

// 然后加载 .env 文件（如果存在的话）
dotenv.config();

const fs = require('fs').promises;
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function translateWithAI(text, targetLanguage) {
  // console.log('翻译开始:', text);
  // console.log('目标语言:', targetLanguage);
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const PROXY_URL = process.env.PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY 环境变量未设置');
  }
  const config = {
    de: "Deutsch",
    ko: "한국어",
    ja: "日本語",
    zh: "简体中文",
    fr: "Français",
    it: "Italiano",
    es: "Español",
  }
  const prompt = `你是一个专业的翻译器。请将以下内容翻译成 ${config[targetLanguage]}，确保翻译符合该语言的习惯和表述，而不是简单直译。
            例如，我给你的内容是 Hello，如果需要你翻译成中文简体，那么你返回的应该是 你好。
            当你遇到产品名称或者品牌词例如 flux kontext dev, YouTube, Twitter/X, LinkedIn 等，请不要翻译这些词汇。
            保持货币符号，比如 $ 和 €
            
            注意：
              1. 只需要返回翻译结果，不要返回其他文字
              2. 不要给出任何解释性描述，不要给出提示性文字
              3. 专注于翻译，如果翻译的是一个疑问句，应该正常翻译而不是回答问题
              4. 如果碰到表情符号emoji，例如 ❌ ✅ 等，请直接返回原文。
          

            检测上述所有内容，没问题再给出最终结果
            
            要翻译的内容：${text}`;

  // 配置请求选项
  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
      }
    })
  };

  // 如果设置了代理，添加代理配置
  if (PROXY_URL) {
    console.log(`使用代理: ${PROXY_URL}`);
    fetchOptions.agent = new HttpsProxyAgent(PROXY_URL);
  }
  const openrouterFetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API}`
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite-preview-06-17",
      messages: [
        {
          role: "system",
          content: prompt
        }
      ]
    })
  }
  if (PROXY_URL) {
    openrouterFetchOptions.agent = new HttpsProxyAgent(PROXY_URL);
  }

  // const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, fetchOptions);
  // console.log('发起请求', openrouterFetchOptions);
  const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, openrouterFetchOptions);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('API 响应错误:', errorText);
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }

  const data = await response.json();
  // console.log('API 响应数据:', JSON.stringify(data, null, 2));

  // if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
  //   console.log('API 响应数据结构不正确:', JSON.stringify(data));
  // }
  if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    console.log('翻译结果:', data.choices[0].message.content.trim());
    return data.choices[0].message.content.trim();
  }

  const translatedText = data.candidates[0].content.parts[0].text.trim();
  console.log('翻译结果:', translatedText);

  return translatedText;
}

// 添加一个延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateMissingKeys(enJson, existingTranslations, targetLanguage, prefix = '') {
  const translatedObj = { ...existingTranslations };
  let hasChanges = false;

  for (const [key, value] of Object.entries(enJson)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (key === 'effectSection') {
      console.log(`跳过 effectSection: ${fullKey}`);
      translatedObj[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      console.log(`处理嵌套对象: ${fullKey}`);
      const result = await translateMissingKeys(
        value,
        existingTranslations[key] || {},
        targetLanguage,
        fullKey
      );
      translatedObj[key] = result.translatedObj;
      if (result.hasChanges) {
        hasChanges = true;
      }
    } else if (typeof value === 'string' && (!(key in existingTranslations) || !existingTranslations[key] || existingTranslations[key].trim() === '')) {
      // 处理缺失的键或空值的情况
      const reason = !(key in existingTranslations) ? '缺失的键' : '空值的键';
      console.log(`翻译${reason}: ${fullKey}`);
      try {
        const translatedValue = await translateWithAI(value, targetLanguage);
        translatedObj[key] = translatedValue;
        console.log(`翻译成功 "${fullKey}": "${value}" => "${translatedValue}"`);
        hasChanges = true;
        await delay(1000); // 添加延迟以避免频繁请求
      } catch (error) {
        console.error(`翻译 "${fullKey}" 时出错:`, error.message);
        translatedObj[key] = value; // 翻译失败时保留原值
        console.log(`保留原值 "${fullKey}": "${value}"`);
        hasChanges = true;
      }
    } else {
      if (key in existingTranslations) {
        console.log(`跳过已存在的键 "${fullKey}"`);
      } else {
        console.log(`保留非字符串值 "${fullKey}": ${value}`);
        hasChanges = true;
      }
      translatedObj[key] = existingTranslations[key] || value;
    }
  }

  return { translatedObj, hasChanges };
}

async function main() {
  try {
    console.log('开始翻译过程...');

    // 读取 en.json 文件
    const enJson = JSON.parse(await fs.readFile('./messages/en.json', 'utf8'));
    console.log('成功读取 en.json 文件');
    // 读取 languageConfig.js 文件
    const languageConfig = require('./src/languageConfig.js');
    console.log('成功读取语言配置文件');

    // 遍历需要支持的语言
    for (const lang of languageConfig.supportedLocales) {
      if (lang === 'en') {
        console.log('跳过英语翻译');
        continue;
      }

      console.log(`\n开始处理 ${lang} 翻译...`);

      let existingTranslations = {};
      const outputPath = path.join(__dirname, `messages/${lang}.json`);

      // 检查目标语言文件是否存在
      try {
        existingTranslations = JSON.parse(await fs.readFile(outputPath, 'utf8'));
        console.log(`找到现有的 ${lang} 翻译文件，将只翻译缺失的键`);
      } catch (error) {
        console.log(`${lang} 翻译文件不存在，将创建新文件并翻译所有键`);
      }

      console.log('开始翻译缺失的键...');
      const result = await translateMissingKeys(enJson, existingTranslations, lang);
      console.log('缺失键翻译完成');

      if (result.hasChanges) {
        await fs.writeFile(outputPath, JSON.stringify(result.translatedObj, null, 2), 'utf8');
        console.log(`${lang} 翻译更新完成，已写入 ${outputPath}`);
      } else {
        console.log(`${lang} 翻译文件已是最新，无需更新`);
      }
    }

    console.log('\n所有语言处理完毕');
  } catch (error) {
    console.error('发生错误:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', await error.response.text());
    }
  }
}

main();