import OpenAI from "https://esm.sh/openai";

/**
 * --- PHẦN 1: CẤU HÌNH API OPENAI-COMPATIBLE ---
 * Model: ces-chatbot-gpt-5.4
 */
const openai = new OpenAI({
    apiKey: "sk-4bd27113b7dc78d1-lh6jld-f4f9c69f",
    baseURL: "https://9router.vuhai.io.vn/v1",
    dangerouslyAllowBrowser: true // Cần thiết khi chạy trực tiếp trên Frontend
});
const MODEL_NAME = "ces-chatbot-gpt-5.4";

// ============================================================
// CẤU HÌNH GOOGLE SHEETS LEAD CAPTURE
// ============================================================
// URL của Google Apps Script Web App (thay YOUR_DEPLOY_ID bằng URL thật sau khi deploy)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwWxm8roOPUXUMiaE20X95TR6ylZzIkZkkoHZnlE3UCQTrj9N-Vom5kKtAHCtw4fs7v/exec';

// Tạo Session ID duy nhất cho mỗi phiên tải trang (để gộp data cùng 1 khách)
const AI_CHAT_SESSION_ID = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

// Lưu trạng thái
let systemPrompt = "";
let messages = [];
let isTyping = false;

// DOM Elements
const toggleBtn = document.getElementById("chatbot-toggle-btn");
const chatContainer = document.getElementById("chatbot-container");
const closeBtn = document.getElementById("chatbot-close-btn");
const refreshBtn = document.getElementById("chatbot-refresh-btn");
const chatMessages = document.getElementById("chatbot-messages");
const chatInput = document.getElementById("chatbot-input");
const sendBtn = document.getElementById("chatbot-send-btn");

/**
 * --- PHẦN 2: TẢI KNOWLEDGE BASE ---
 * (Lấy dữ liệu từ file chatbot_data.txt)
 */
async function loadKnowledgeBase() {
    try {
        const res = await fetch("chatbot_data.txt");
        if (!res.ok) throw new Error("Chưa có file chatbot_data.txt");
        const kbData = await res.text();

        systemPrompt = `
ĐÓNG VAI: Bạn là Trợ lý AI độc quyền của chuyên gia Nguyễn Văn A.
QUY TẮC BẮT BUỘC:
1. LUÔN chào hỏi thân thiện ở câu đầu tiên.
2. CHỈ TRẢ LỜI dựa trên Dữ liệu (Knowledge Base) bên dưới.
3. Nếu người dùng hỏi ngoài phạm vi, từ chối nhẹ nhàng, lịch sự và hướng dẫn họ liên hệ email hoặc Zalo của chuyên gia (được đề cập trong Dữ liệu).
4. SỬ DỤNG Markdown để làm đẹp câu trả lời (Danh sách, In đậm câu quan trọng, Đoạn code).
5. Cuối câu trả lời LUÔN có một câu hỏi gợi mở để hỗ trợ tiếp.

=== DỮ LIỆU KNOWLEDGE BASE VỀ CHUYÊN GIA ===
${kbData}
=== HẾT DỮ LIỆU ===

=== QUY TẮC ĐẶC BIỆT (LEAD CAPTURE) ===
Trong quá trình trò chuyện, nếu bạn phát hiện người dùng cung cấp Tên, Số điện thoại hoặc Email, bạn HÃY VỪA trả lời họ bình thường, VỪA chèn thêm một đoạn mã JSON vào cuối cùng của câu trả lời theo đúng định dạng sau:
||LEAD_DATA: {"name": "...", "phone": "...", "email": "..."}||
Nếu thông tin nào chưa có, hãy để null.
TUYỆT ĐỐI KHÔNG giải thích hay đề cập đến đoạn mã này cho người dùng.
=== HẾT QUY TẮC ===
`;
    } catch (err) {
        console.error("Lỗi tải Knowledge Base:", err);
        systemPrompt = "Bạn là trợ lý AI hữu ích.";
    }
}


/**
 * --- PHẦN 3: GIAO DIỆN (UI/UX) ---
 */

// Đóng mở chatbot
function toggleChat() {
    chatContainer.classList.toggle("hidden");
    if (!chatContainer.classList.contains("hidden")) {
        chatInput.focus();
    }
}

// Cuộn mượt xuống cuối
function scrollToBottom() {
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
}

// Logic Nút Xoay Làm Mới (Refresh)
function resetChat() {
    // 1. Thêm animation xoay vòng
    refreshBtn.classList.add("refreshing");
    
    // 2. Xóa sạch lịch sử hội thoại trên Giao diện lẫn Mảng dữ liệu
    chatMessages.innerHTML = '';
    messages = [];
    isTyping = false;

    // 3. Render tin nhắn Hello default
    setTimeout(() => {
        appendMessage("bot", "Xin chào! 👋 Tôi là trợ lý AI của K89. Bạn cần tìm hiểu thông tin gì về tự động hóa và khóa học Agentic AI hôm nay?");
    }, 100);

    // 4. Dừng sau đúng 500ms
    setTimeout(() => {
        refreshBtn.classList.remove("refreshing");
    }, 500);
}

// Render Bong bóng Chat
function appendMessage(role, content) {
    const bubble = document.createElement("div");
    
    // Check nếu là bot thì thêm class để chứa định dạng markdown
    if (role === 'bot') {
        bubble.className = `chat-bubble bot chat-markdown`;
        bubble.innerHTML = marked.parse(content);
    } else {
        bubble.className = `chat-bubble user`;
        bubble.textContent = content; // User text thường (tránh XSS)
    }
    
    chatMessages.appendChild(bubble);
    scrollToBottom();
}

// Typing UI (... Nhảy 3 dấu chấm)
function showTyping() {
    isTyping = true;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble bot typing-bubble";
    bubble.id = "typing-indicator";
    
    // Tạo 3 dấu chấm 
    bubble.innerHTML = `
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    chatMessages.appendChild(bubble);
    scrollToBottom();
}

function removeTyping() {
    isTyping = false;
    const indicator = document.getElementById("typing-indicator");
    if (indicator) indicator.remove();
}


/**
 * --- PHẦN 3.5: XỬ LÝ LEAD DATA TỪ AI RESPONSE ---
 */

// Regex pattern bóc tách tag ẩn ||LEAD_DATA: {...}||
const LEAD_DATA_PATTERN = /\|\|LEAD_DATA:\s*(\{.*?\})\s*\|\|/;

/**
 * Xử lý response từ AI:
 * 1. Kiểm tra có tag ||LEAD_DATA:...|| không
 * 2. Nếu có → Parse JSON → Gửi lên Google Sheets kèm Lịch sử Chat & Session ID
 * 3. Xóa tag khỏi câu trả lời → Trả lại text sạch cho hiển thị
 */
function processAIResponse(aiResponse, chatHistoryArray = []) {
    // Xây dựng text lịch sử chat cho dễ đọc trên Google Sheets
    let formattedHistory = "";
    if (chatHistoryArray && chatHistoryArray.length > 0) {
        formattedHistory = chatHistoryArray.map(msg => {
            let role = msg.role === 'user' ? 'Khách' : 'AI';
            // Lọc bỏ tag ẩn trước khi lưu vào Sheets
            let content = msg.content.replace(LEAD_DATA_PATTERN, "").trim();
            return `${role}: ${content}`;
        }).join('\n\n');
    }

    if (aiResponse.includes("||LEAD_DATA:")) {
        const match = aiResponse.match(LEAD_DATA_PATTERN);

        if (match && match[1]) {
            try {
                const leadData = JSON.parse(match[1]);
                console.log("✅ Dữ liệu khách hàng bóc được:", leadData);

                // Gửi dữ liệu nếu có ít nhất 1 trường hợp lệ
                if (leadData.name || leadData.phone || leadData.email) {
                    sendLeadToGoogleSheets(leadData, formattedHistory);
                }
            } catch (error) {
                console.error("❌ Lỗi parse JSON từ AI:", error);
            }
        }
        // Xóa tag ẩn khỏi câu trả lời
        aiResponse = aiResponse.replace(LEAD_DATA_PATTERN, "").trim();
    }
    return aiResponse;
}

/**
 * Gửi dữ liệu Lead lên Google Apps Script → Google Sheets
 */
async function sendLeadToGoogleSheets(leadData, chatHistoryText) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: leadData.name || '',
                phone: leadData.phone || '',
                email: leadData.email || '',
                source: window.location.href,
                sessionId: AI_CHAT_SESSION_ID,
                chatHistory: chatHistoryText,
                timestamp: new Date().toLocaleString('vi-VN')
            })
        });
        console.log("📤 Đã đồng bộ dữ liệu vào Google Sheets!");
    } catch (err) {
        console.warn("⚠️ Không gửi được dữ liệu lead:", err);
    }
}


/**
 * --- PHẦN 4: LOGIC GỬI API (OPENROUTER) ---
 */
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isTyping) return; // Chặn spam trong lúc AI xử lý

    // 1. Add User Msg
    appendMessage("user", text);
    chatInput.value = "";
    messages.push({ role: "user", content: text });

    // 2. Show 'Đang nhập...'
    showTyping();

    // 3. Build Body OpenRouter 
    const payloadMessages = [
        { role: "system", content: systemPrompt },
        ...messages
    ];

    try {
        const response = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: payloadMessages,
        });

        // Xóa Typing sau khi nhận được Phản hồi API
        removeTyping();
        
        if (response && response.choices && response.choices.length > 0) {
            let aiReply = response.choices[0].message.content;
            // Xử lý lead data trước khi hiển thị (bóc tách tag ẩn + gửi Sheets)
            aiReply = processAIResponse(aiReply, messages);
            appendMessage("bot", aiReply);
            messages.push({ role: "assistant", content: aiReply });
        } else {
            throw new Error("API return empty choices");
        }
        
    } catch (error) {
        console.error("Lỗi API:", error);
        removeTyping();
        appendMessage("bot", "**Lỗi mạng:** Xin lỗi, hiện tại AI đang xử lý quá tải. Bạn vui lòng thử lại sau giây lát.");
    }
}


/**
 * --- PHẦN 5: SỰ KIỆN LẮNG NGHE (EventListeners) ---
 */
toggleBtn.addEventListener("click", toggleChat);
closeBtn.addEventListener("click", toggleChat);
refreshBtn.addEventListener("click", resetChat);

sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => {
    // Nếu gõ Enter thì Submit
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    }
});

// Chạy Khởi Tạo (Init)
document.addEventListener("DOMContentLoaded", async () => {
    // Config bảo mật link cho Markup.js
    marked.use({
        gfm: true,
        breaks: true
    });

    await loadKnowledgeBase();
    resetChat(); // Setup và chào hỏi ban đầu! 
});
