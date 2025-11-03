// Firebase 配置 - 使用硬编码的配置，因为环境变量在屏幕外文档中不可用
const firebaseConfig = {
  apiKey: "AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890",
  measurementId: "G-XXXXXXXXXX"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// 更新状态显示
document.getElementById('auth-status').textContent = 'Firebase 已初始化';

// 监听来自扩展的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    return false;
  }

  if (message.type === 'firebase-auth') {
    handleAuth()
      .then(sendResponse)
      .catch(sendResponse);
    return true;
  }
});

// 处理认证流程
async function handleAuth() {
  try {
    document.getElementById('auth-status').textContent = '正在处理认证...';
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    document.getElementById('auth-status').textContent = '认证成功';
    return {
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL
      }
    };
  } catch (error) {
    document.getElementById('auth-status').textContent = '认证失败: ' + error.message;
    console.error('Authentication error:', error);
    throw error;
  }
} 