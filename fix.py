import re

with open('src/lib/api.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the specific malformed block
block = """      if (!response.ok) {
        if (response.status === 401) {
          setAuthToken(null);
          window.dispatchEvent(new Event('grid_auth_expired'));
        }
        let message = data?.message;
        if (response.status === 413) {
          message = data?.message || 'Ảnh vượt quá dung lượng cho phép (413). Hệ thống đã tự động nén ảnh nhưng vẫn vượt giới hạn, vui lòng chọn ảnh nhỏ hơn.';
        } else if (response.status === 401) {
          message = data?.message || 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
        } else if (response.status === 403) {
          message = data?.message || 'Bạn không có quyền thực hiện thao tác này.';
        } else if (response.status === 404) {
          message = data?.message || 'Không tìm thấy API hoặc đường dẫn yêu cầu (404).';
        } else if (response.status >= 500) {
          message = data?.message || 'Máy chủ gặp lỗi khi xử lý yêu cầu hoặc dữ liệu.';
        }
        const error: any = new Error(message || `Lỗi yêu cầu hệ thống (${response.status})`);
        error.status = response.status;
        error.data = data;
        error.errors = data?.errors;
        error.usage = data?.usage;
        throw error;
      }"""

# Since the file has replacement characters, we can use a regex to match the lines and replace them.
import re
pattern = re.compile(r'      if \(\!response\.ok\) \{.*?throw error;\n      \}', re.DOTALL)
text = pattern.sub(block, text)

with open('src/lib/api.ts', 'w', encoding='utf-8') as f:
    f.write(text)
