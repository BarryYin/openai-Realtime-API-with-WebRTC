let peerConnection = null;
let dataChannel = null;

async function init() {
  try {
    console.log("开始初始化...");
    
    // Get an ephemeral key from your server
    const tokenResponse = await fetch("/session");
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`服务器返回错误 ${tokenResponse.status}: ${errorText}`);
    }
    
    const data = await tokenResponse.json();
    console.log("服务器返回数据:", data);
    
    if (!data.client_secret || !data.client_secret.value) {
      throw new Error("服务器返回的数据格式不正确: " + JSON.stringify(data));
    }
    
    const EPHEMERAL_KEY = data.client_secret.value;
    console.log("获取到临时密钥");

    // Create a peer connection
    const pc = new RTCPeerConnection();
    console.log("创建RTCPeerConnection");

    // Set up to play remote audio from the model
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    pc.ontrack = e => {
      audioEl.srcObject = e.streams[0];
      console.log("收到音频流");
    };

    // Add local audio track for microphone input
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      pc.addTrack(ms.getTracks()[0]);
      console.log("添加本地音频轨道");
    } catch (err) {
      console.error("获取麦克风失败:", err);
      alert("请允许使用麦克风");
      return;
    }

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events");
    dc.addEventListener("message", (e) => {
      // Realtime server events appear here!
      console.log(e);
    });
    console.log("设置数据通道");

    // Start the session using SDP
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log("创建并设置本地描述");

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    
    try {
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp"
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`OpenAI API returned ${sdpResponse.status}`);
      }

      const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer);
      console.log("连接建立成功");
      
      // 启用发送按钮
      document.getElementById('sendButton').disabled = false;
      
      peerConnection = pc;
      dataChannel = dc;
      
      const connectButton = document.getElementById('connectButton');
      const disconnectButton = document.getElementById('disconnectButton');
      const status = document.getElementById('status');
      
      connectButton.style.display = 'none';
      disconnectButton.style.display = 'inline-block';
      status.textContent = '状态：已连接';
      
    } catch (err) {
      console.error("连接OpenAI失败:", err);
      alert("连接OpenAI失败，请检查API密钥是否正确");
      return;
    }
  } catch (err) {
    console.error("初始化失败:", err);
    alert("初始化失败: " + err.message);
  }
}

function disconnect() {
  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }
  
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  const connectButton = document.getElementById('connectButton');
  const disconnectButton = document.getElementById('disconnectButton');
  const status = document.getElementById('status');
  const sendButton = document.getElementById('sendButton');
  
  connectButton.style.display = 'inline-block';
  disconnectButton.style.display = 'none';
  status.textContent = '状态：未连接';
  sendButton.disabled = true;
}

// 导出init函数到全局作用域
window.init = init;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('disconnectButton').addEventListener('click', disconnect);
});

init();