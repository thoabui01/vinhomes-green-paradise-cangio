/**
 * Google Apps Script Webhook Demo cho Dự án Vinhomes Green Paradise Cần Giờ
 * Hướng dẫn cài đặt:
 * 1. Mở trang Google Sheets mới.
 * 2. Đặt tên các cột A->I tương ứng: Thời gian | Tên | SĐT | Email | Nguồn | Session ID | Lịch sử chat | Quan tâm | Mức độ
 * 3. Extensions (Tiện ích mở rộng) -> Apps Script.
 * 4. Paste mã này vào file Code.gs.
 * 5. Deploy -> New Deployment -> Web app (Execute as Me, Anyone with link).
 * 6. Copy Web App URL và thay vào biến WEBHOOK_URL trong file script.js
 */

function doPost(e) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    try {
        var data = JSON.parse(e.postData.contents);
        
        // Cập nhật hoặc thêm hàng mới dựa trên sessionId
        var dataRange = sheet.getDataRange();
        var values = dataRange.getValues();
        var rowIndex = -1;
        
        // Tìm sessionId xem đã tồn tại chưa để update thay vì tạo mới
        for (var i = 1; i < values.length; i++) {
            if (values[i][5] == data.sessionId) { // Cột F là Session ID (index 5)
                rowIndex = i + 1; // Apps Script index bắt đầu từ 1
                break;
            }
        }
        
        var rowData = [
            data.timestamp,
            data.name,
            data.phone,
            data.email,
            data.source,
            data.sessionId,
            data.chatHistory,
            data.interest,
            data.level
        ];
        
        if (rowIndex > -1) {
            // Update
            sheet.getRange(rowIndex, 1, 1, 9).setValues([rowData]);
        } else {
            // Thêm mới
            sheet.appendRow(rowData);
        }

        // Gửi email nếu Mức độ là HOT (chỉ gửi 1 lần khi có đủ thông tin)
        // Tạo thêm properties script_properties để đảm bảo ko gửi spam email cho cùng 1 session
        var props = PropertiesService.getScriptProperties();
        var emailSentFlag = props.getProperty('email_sent_' + data.sessionId);
        
        if (data.level.toLowerCase() === 'hot' && !emailSentFlag) {
            var subject = "📢 KHÁCH HÀNG NÓNG - CẦN LIÊN HỆ NGAY!";
            var body = "Tên: " + data.name + "\n" +
                       "SĐT: " + data.phone + "\n" +
                       "Email: " + data.email + "\n" +
                       "Quan tâm: " + data.interest + "\n" +
                       "Thời gian: " + data.timestamp + "\n\n" +
                       "Vui lòng liên hệ khách hàng này trong vòng 30 phút!\n\n" +
                       "--\nLịch sử chat sơ lược:\n" + data.chatHistory;
                       
            MailApp.sendEmail({
                to: "btkt.thoa@gmail.com",
                subject: subject,
                body: body
            });
            
            props.setProperty('email_sent_' + data.sessionId, 'true');
        }
        
        return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
                             .setMimeType(ContentService.MimeType.JSON);
                             
    } catch(err) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": err.message }))
                             .setMimeType(ContentService.MimeType.JSON);
    }
}
