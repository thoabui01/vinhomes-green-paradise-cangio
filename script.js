const sessionId = "sess_" + Math.random().toString(36).substr(2, 9);
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzL5c2_y7Y6q3V3M6_1QeL6pD3J/exec"; // Placeholder GAS URL
const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY_HERE"; // User needs to replace or proxy

// DOM Elements
const chatbotToggle = document.getElementById('chatbot-toggle');
const chatbotContainer = document.getElementById('chatbot-container');
const chatbotClose = document.getElementById('chatbot-close');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatMessages = document.getElementById('chat-messages');

let chatHistory = [
    {
        role: "system",
        content: `Bạn là trợ lý ảo chuyên nghiệp tư vấn dự án bất động sản "Vinhomes Green Paradise Cần Giờ". 
Mục tiêu của bạn:
1. Trả lời các câu hỏi về dự án một cách thân thiện, cuốn hút và tôn lên giá trị đẳng cấp thượng lưu, nghỉ dưỡng.
2. Thuyết phục khách hàng để lại thông tin liên hệ (Tên, SĐT, Email).
3. Đánh giá Mức độ quan tâm của khách (hot, warm, cold).

Bạn CẦN THIẾT phân tích và trả về thông tin dưới dạng JSON đặc biệt trong phản hồi của bạn nếu có thể thu thập đủ thông tin (chỉ trả về JSON ẩn ở cuối, tin nhắn cho người dùng vẫn bình thường).
Cấu trúc JSON ẩn (vd: \`\`\`json {"name": "A", "phone": "098", "email": "a@b.c", "interest": "Biệt thự đơn lập", "level": "hot"} \`\`\`)
Tự động xem ngữ cảnh trò chuyện để gán level = hot nếu khách muốn mua/gặp trực tiếp/gọi ngay.`
    }
];

let extractedLeadData = {
    name: "", phone: "", email: "", interest: "", level: "cold"
};
let leadSent = false;

// Chatbot interactions
chatbotToggle.addEventListener('click', () => {
    chatbotContainer.classList.remove('hidden');
    chatbotToggle.style.display = 'none';
});

chatbotClose.addEventListener('click', () => {
    chatbotContainer.classList.add('hidden');
    chatbotToggle.style.display = 'flex';
});

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function appendMessage(text, isBot = false) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.classList.add(isBot ? 'bot' : 'user');
    
    if (isBot) {
        div.innerHTML = marked.parse(text); // parse markdown
    } else {
        div.textContent = text;
    }
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    appendMessage(text, false);
    chatInput.value = '';
    
    chatHistory.push({ role: "user", content: text });
    
    // Add loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('message', 'bot');
    loadingDiv.innerHTML = '<span class="gold-text">Đang trả lời...</span>';
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        // Send request to LLM API (Proxy or direct for demo)
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // fallback model
                messages: chatHistory,
                temperature: 0.7
            })
        });

        const data = await response.json();
        chatMessages.removeChild(loadingDiv);

        if(data.choices && data.choices.length > 0) {
            let reply = data.choices[0].message.content;
            chatHistory.push({ role: "assistant", content: reply });
            
            // Check for hidden JSON for lead extraction
            const jsonMatch = reply.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    extractedLeadData = { ...extractedLeadData, ...parsed };
                    reply = reply.replace(jsonMatch[0], ''); // remove hidden tag from display
                    
                    if (extractedLeadData.phone && !leadSent) {
                        sendLeadToGoogleSheets();
                    }
                } catch(e) {}
            }
            
            appendMessage(reply, true);
        } else {
             appendMessage("Hệ thống đang bận, quý khách có thể gọi Hotline 0906363106 để được hỗ trợ tức thì.", true);
        }

    } catch (e) {
        chatMessages.removeChild(loadingDiv);
        appendMessage("Lỗi kết nối máy chủ AI. Vui lòng gọi trực tiếp: 0906363106", true);
    }
}

async function sendLeadToGoogleSheets() {
    // Format the chat history to a readable string
    const stringifiedHistory = chatHistory
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'Khách' : 'AI'}: ${m.content.replace(/```json[\s\S]*```/g,'')}`)
        .join('\n');

    const payload = {
        timestamp: new Date().toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'}),
        name: extractedLeadData.name || "Khách Hàng",
        phone: extractedLeadData.phone,
        email: extractedLeadData.email || "Không có",
        source: "Website Chatbot",
        sessionId: sessionId,
        chatHistory: stringifiedHistory,
        interest: extractedLeadData.interest || "Đang tìm hiểu",
        level: extractedLeadData.level || "warm"
    };

    try {
        await fetch(WEBHOOK_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        leadSent = true;
        console.log("Lead captured and sent!");
    } catch(err) {
        console.error("Gửi webhook thất bại", err);
    }
}
