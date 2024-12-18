// 等待 init.js 中的连接建立后再执行
let dc;

window.setupDataChannel = function(peerConnection) {
    // Create a data channel from a peer connection
    dc = peerConnection.createDataChannel("oai-events");

    // Listen for server-sent events on the data channel
    dc.addEventListener("message", (e) => {
        try {
            const realtimeEvent = JSON.parse(e.data);
            console.log(realtimeEvent);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
};

// 发送消息的函数
window.sendMessage = function() {
    if (!dc) {
        console.error('Data channel not established yet');
        return;
    }
    
    // Send client events by serializing a valid client event to JSON
    const responseCreate = {
        type: "response.create",
        response: {
            modalities: ["text"],
            instructions: "Write a haiku about code",
        },
    };
    try {
        dc.send(JSON.stringify(responseCreate));
    } catch (error) {
        console.error('Error sending message:', error);
    }
};